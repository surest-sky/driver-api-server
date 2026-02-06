#!/usr/bin/env python3
"""
APK 上传脚本
功能：
1. 读取 Flutter 构建的 APK 文件
2. 上传到 AWS S3
3. 获取公开访问链接
4. 更新 download.hbs 中的下载链接
5. 推送代码到 Git
"""

import os
import re
import sys
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
ENV_PATH = Path("/Users/surest/www/driver/api-server/.env")
DOWNLOAD_HBS_PATH = Path("/Users/surest/www/driver/api-server/views/download.hbs")
API_SERVER_PATH = Path("/Users/surest/www/driver/api-server")


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


def check_apk_exists(apk_path: Path) -> None:
    """检查 APK 文件是否存在"""
    if not apk_path.exists():
        print(f"错误: APK 文件不存在: {apk_path}")
        print("请先构建 APK: cd driver_video_app && flutter build apk --release")
        sys.exit(1)

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


def update_download_hbs(hbs_path: Path, apk_url: str) -> None:
    """更新 download.hbs 中的 APK 下载链接"""
    if not hbs_path.exists():
        print(f"错误: download.hbs 文件不存在: {hbs_path}")
        sys.exit(1)

    with open(hbs_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 查找 APK Download 的 a 标签并更新 href
    # 匹配 APK Direct 或 APK Download 卡片中的链接
    pattern = r'(<!-- APK Direct -->.*?<a href=)("[^"]*"|\'[^\']*\')(.*?>.*?Download APK</a>)'

    def replace_link(match):
        return f'{match.group(1)}"{apk_url}"{match.group(3)}'

    new_content, count = re.subn(pattern, replace_link, content, flags=re.DOTALL)

    if count == 0:
        print("警告: 未找到 APK 下载链接，尝试简单替换...")
        # 备用方案：简单替换 href="#"
        new_content = re.sub(
            r'(<!-- APK Direct -->.*?<a href=)"#"',
            f'\\1"{apk_url}"',
            new_content,
            flags=re.DOTALL
        )

    with open(hbs_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"\n已更新 download.hbs")
    print(f"  新链接: {apk_url}")


def git_commit_and_push(repo_path: Path, apk_url: str) -> None:
    """提交并推送代码到 Git"""
    print(f"\n提交代码到 Git...")

    import subprocess

    try:
        # 切换到 api-server 目录
        os.chdir(repo_path)

        # 检查 git 状态
        result = subprocess.run(
            ['git', 'status', '--short'],
            capture_output=True,
            text=True
        )

        if not result.stdout.strip():
            print("没有需要提交的更改")
            return

        # 添加文件
        subprocess.run(['git', 'add', 'views/download.hbs'], check=True)

        # 提交
        commit_message = f"chore: update APK download link\n\nAPK URL: {apk_url}"
        subprocess.run(['git', 'commit', '-m', commit_message], check=True)

        # 推送
        print("推送到远程仓库...")
        subprocess.run(['git', 'push'], check=True)

        print("代码已推送!")

    except subprocess.CalledProcessError as e:
        print(f"警告: Git 操作失败: {e}")
        print("请手动提交并推送代码")


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

    # 4. 更新 download.hbs
    update_download_hbs(DOWNLOAD_HBS_PATH, apk_url)

    # 5. Git 提交和推送
    git_commit_and_push(API_SERVER_PATH, apk_url)

    print("\n" + "=" * 50)
    print("完成!")
    print(f"APK 下载链接: {apk_url}")
    print("=" * 50)


if __name__ == "__main__":
    main()
