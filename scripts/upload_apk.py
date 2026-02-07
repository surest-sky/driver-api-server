#!/usr/bin/env python3
"""
APK 上传脚本
功能：
1. 读取 Flutter 构建的 APK 文件
2. 上传到 AWS S3
3. 获取公开访问链接
4. 发布版本信息到 API
"""

import os
import sys
import json
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from datetime import datetime

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError, SSLError, EndpointConnectionError
except ImportError:
    print("错误: 需要安装 boto3")
    print("请运行: pip install boto3")
    sys.exit(1)


# 配置路径
APK_PATH = Path("/Users/surest/www/driver/driver_video_app/build/app/outputs/flutter-apk/app-release.apk")
FLUTTER_APP_DIR = Path("/Users/surest/www/driver/driver_video_app")
ENV_PATH = Path("/Users/surest/www/driver/api-server/.env")


def load_env(env_path: Path) -> dict:
    """读取 .env 文件"""
    env_vars = {}
    if not env_path.exists():
        print(f"错误: .env 文件不存在: {env_path}")
        sys.exit(1)

    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()

    return env_vars


def _run_build(command: list[str], cwd: Path) -> bool:
    print(f"尝试执行构建命令: {' '.join(command)}")
    try:
        subprocess.run(command, cwd=str(cwd), check=True)
        return True
    except FileNotFoundError:
        print(f"命令不存在: {command[0]}")
        return False
    except subprocess.CalledProcessError as e:
        print(f"构建失败，退出码: {e.returncode}")
        return False


def build_apk_if_missing(apk_path: Path) -> None:
    """APK 不存在时自动构建。"""
    if apk_path.exists():
        return

    print(f"未找到 APK: {apk_path}")
    print("开始自动构建 APK...")

    if not FLUTTER_APP_DIR.exists():
        print(f"错误: Flutter 项目目录不存在: {FLUTTER_APP_DIR}")
        sys.exit(1)

    build_ok = False

    if shutil.which("flutter"):
        build_ok = _run_build(["flutter", "build", "apk", "--release"], FLUTTER_APP_DIR)

    if not build_ok and shutil.which("fvm"):
        print("尝试使用 fvm 构建...")
        build_ok = _run_build(["fvm", "flutter", "build", "apk", "--release"], FLUTTER_APP_DIR)

    if not build_ok:
        print("错误: 自动构建 APK 失败。")
        print("请手动执行: cd driver_video_app && flutter build apk --release")
        sys.exit(1)

    if not apk_path.exists():
        print("错误: 构建命令执行完成，但未找到 APK 输出文件。")
        print(f"期望路径: {apk_path}")
        sys.exit(1)

    print("APK 自动构建成功。")


def check_apk_exists(apk_path: Path) -> None:
    """检查 APK 文件是否存在，不存在则自动构建。"""
    build_apk_if_missing(apk_path)

    apk_size = apk_path.stat().st_size
    size_mb = apk_size / (1024 * 1024)
    print(f"找到 APK 文件: {apk_path.name} ({size_mb:.2f} MB)")


def upload_to_s3(apk_path: Path, env_vars: dict) -> str:
    """上传 APK 到 AWS S3 并返回公开链接"""
    required_vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_REGION', 'AWS_S3_BUCKET']
    missing_vars = [v for v in required_vars if not env_vars.get(v)]

    if missing_vars:
        print(f"错误: 缺少必要的环境变量: {', '.join(missing_vars)}")
        sys.exit(1)

    # 生成 S3 对象键 (带版本号/时间戳避免缓存)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    apk_filename = f"driveviewer-{timestamp}.apk"
    s3_key = f"apk/{apk_filename}"

    print(f"\n开始上传到 S3...")
    print(f"  Bucket: {env_vars['AWS_S3_BUCKET']}")
    print(f"  Key: {s3_key}")

    try:
        endpoint_url = (env_vars.get('AWS_S3_ENDPOINT') or '').strip() or None
        force_path_style = (env_vars.get('AWS_S3_FORCE_PATH_STYLE') or 'false').strip().lower() in (
            '1', 'true', 'yes', 'y'
        )
        verify_env = (env_vars.get('AWS_S3_VERIFY_SSL') or 'true').strip().lower()
        verify_ssl = verify_env in ('1', 'true', 'yes', 'y')
        ca_bundle = (env_vars.get('AWS_S3_CA_BUNDLE') or os.environ.get('AWS_CA_BUNDLE') or '').strip()

        s3_config = Config(
            s3={'addressing_style': 'path' if force_path_style else 'virtual'},
            retries={'max_attempts': 10, 'mode': 'standard'},
            connect_timeout=10,
            read_timeout=60,
        )

        if not verify_ssl:
            print("警告: AWS_S3_VERIFY_SSL=false，已禁用 SSL 验证（仅排错用）")

        # 创建 S3 客户端
        s3_client = boto3.client(
            's3',
            aws_access_key_id=env_vars['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=env_vars['AWS_SECRET_ACCESS_KEY'],
            region_name=env_vars['AWS_S3_REGION'],
            endpoint_url=endpoint_url,
            config=s3_config,
            verify=(False if not verify_ssl else (ca_bundle or True)),
        )

        # 上传文件
        s3_client.upload_file(
            str(apk_path),
            env_vars['AWS_S3_BUCKET'],
            s3_key,
            ExtraArgs={'ContentType': 'application/vnd.android.package-archive'}
        )

        print("上传成功!")

        # 生成公开 URL
        public_base_url = env_vars.get('AWS_S3_PUBLIC_BASE_URL', '').rstrip('/')
        apk_url = f"{public_base_url}/{s3_key}"

        return apk_url

    except SSLError as e:
        print("错误: SSL 连接失败，可能是代理/证书/网络问题。")
        print(f"详情: {e}")
        print("建议: 检查 HTTPS 代理、证书链，或设置 AWS_S3_CA_BUNDLE 指向自定义证书。")
        print("如需临时排错，可设置 AWS_S3_VERIFY_SSL=false（不建议长期使用）。")
        sys.exit(1)
    except EndpointConnectionError as e:
        print("错误: 无法连接到 S3 端点。")
        print(f"详情: {e}")
        print("建议: 检查网络、AWS_S3_REGION、AWS_S3_ENDPOINT。")
        sys.exit(1)
    except ClientError as e:
        print(f"错误: S3 上传失败: {e}")
        sys.exit(1)


def prompt_non_empty(prompt: str) -> str:
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("输入不能为空，请重试。")


def prompt_positive_int(prompt: str) -> int:
    while True:
        value = input(prompt).strip()
        if not value:
            print("输入不能为空，请重试。")
            continue
        if value.isdigit() and int(value) > 0:
            return int(value)
        print("请输入正整数。")


def prompt_yes_no(prompt: str, default: bool = False) -> bool:
    suffix = "Y/n" if default else "y/N"
    while True:
        value = input(f"{prompt} ({suffix}): ").strip().lower()
        if not value:
            return default
        if value in ("y", "yes", "1", "true"):
            return True
        if value in ("n", "no", "0", "false"):
            return False
        print("请输入 y 或 n。")


def prompt_release_notes() -> str:
    print("\n请输入更新内容（可多行，输入单独一行 END 结束）：")
    lines = []
    while True:
        line = input()
        if line.strip() == "END":
            break
        lines.append(line.rstrip())
    return "\n".join(lines).strip()


def collect_publish_payload(apk_url: str) -> dict:
    print("\n请填写版本发布信息：")
    version = prompt_non_empty("版本号（例如 1.1.6）: ")
    version_code = prompt_positive_int("versionCode（正整数）: ")
    build_number = prompt_positive_int("buildNumber（正整数）: ")
    release_notes = prompt_release_notes()
    force_update = prompt_yes_no("是否强制更新", default=False)

    payload = {
        "platform": "android",
        "version": version,
        "versionCode": version_code,
        "buildNumber": build_number,
        "releaseNotes": release_notes,
        "forceUpdate": force_update,
        "downloadUrl": apk_url,
        "isActive": True,
    }
    return payload


def publish_update(env_vars: dict, payload: dict) -> None:
    base_url = (env_vars.get("APP_UPDATE_API_BASE_URL") or "").strip() or "http://127.0.0.1:3008"
    publish_path = (env_vars.get("APP_UPDATE_PUBLISH_PATH") or "").strip() or "/api/app-updates/publish"
    api_token = (env_vars.get("APP_UPDATE_API_TOKEN") or "").strip()
    url = f"{base_url.rstrip('/')}/{publish_path.lstrip('/')}"

    print("\n发布版本信息到 API...")
    print(f"  URL: {url}")

    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
    }
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    request = urllib.request.Request(url=url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            print("版本发布成功!")
            print(f"  id: {data.get('id')}")
            print(f"  version: {data.get('version')}")
            print(f"  forceUpdate: {data.get('forceUpdate')}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        print(f"错误: 版本发布失败，HTTP {e.code}")
        print(detail or e.reason)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"错误: 无法连接版本发布接口: {e.reason}")
        sys.exit(1)


def main():
    print("=" * 50)
    print("APK 上传脚本")
    print("=" * 50)

    # 1. 检查 APK 文件
    check_apk_exists(APK_PATH)

    # 2. 读取环境变量
    print("\n读取环境变量...")
    env_vars = load_env(ENV_PATH)

    # 3. 上传到 S3
    apk_url = upload_to_s3(APK_PATH, env_vars)

    # 4. 发布版本信息
    payload = collect_publish_payload(apk_url)
    publish_update(env_vars, payload)

    print("\n" + "=" * 50)
    print("完成!")
    print(f"APK 下载链接: {apk_url}")
    print("=" * 50)


if __name__ == "__main__":
    main()
