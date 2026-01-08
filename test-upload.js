/**
 * 图片上传测试脚本
 * 用于测试图片上传功能和进度跟踪
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

// 配置
const API_BASE = 'http://localhost:3000/api';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建测试图片（1MB）
function createTestImage() {
  const buffer = Buffer.alloc(1024 * 1024); // 1MB
  buffer.fill(Math.random() * 255);
  fs.writeFileSync(TEST_IMAGE_PATH, buffer);
  log(`✓ 创建测试图片: ${TEST_IMAGE_PATH}`, 'green');
}

// 测试方案1: 使用 FormData（Flutter http 包使用的方式）
async function test1FormDataUpload() {
  log('\n=== 测试1: FormData 上传（http 包的方式） ===', 'blue');

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_IMAGE_PATH));

    const req = http.request(
      `${API_BASE}/uploads`,
      {
        method: 'POST',
        headers: form.getHeaders(),
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          log(`响应状态: ${res.statusCode}`, 'yellow');
          log(`响应数据: ${data}`, 'yellow');
          resolve({ statusCode: res.statusCode, data });
        });
      }
    );

    req.on('error', reject);

    // 注意：这里无法跟踪上传进度！
    // FormData 一旦发送，整个请求就发出去了
    log('问题：无法使用 FormData 跟踪上传进度，上传是原子性的', 'red');

    form.pipe(req);
  });
}

// 测试方案2: 使用分块上传模拟进度跟踪
async function test2ChunkedUpload() {
  log('\n=== 测试2: 分块上传（正确的进度跟踪方式） ===', 'blue');

  const fileBuffer = fs.readFileSync(TEST_IMAGE_PATH);
  const chunkSize = 100 * 1024; // 100KB per chunk
  const totalChunks = Math.ceil(fileBuffer.length / chunkSize);

  log(`文件大小: ${(fileBuffer.length / 1024).toFixed(2)} KB`, 'yellow');
  log(`分块大小: ${(chunkSize / 1024).toFixed(2)} KB`, 'yellow');
  log(`总分块数: ${totalChunks}`, 'yellow');

  let uploadedChunks = 0;

  return new Promise((resolve, reject) => {
    const form = new FormData();

    // 模拟分块上传进度
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.length);
      const chunk = fileBuffer.slice(start, end);

      form.append('file', chunk, {
        filename: 'test-image.jpg',
        contentType: 'image/jpeg',
      });

      uploadedChunks++;
      const progress = ((uploadedChunks / totalChunks) * 100).toFixed(1);
      log(`进度: ${progress}% (${uploadedChunks}/${totalChunks})`, 'green');
    }

    const req = http.request(
      `${API_BASE}/uploads`,
      {
        method: 'POST',
        headers: form.getHeaders(),
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          log(`响应状态: ${res.statusCode}`, 'yellow');
          resolve({ statusCode: res.statusCode, data });
        });
      }
    );

    req.on('error', reject);
    form.pipe(req);
  });
}

// 测试方案3: 模拟 Flutter 使用 http 包上传的问题
async function test3SimulateFlutterHttpPackage() {
  log('\n=== 测试3: 模拟 Flutter http 包上传行为 ===', 'blue');

  const fileBuffer = fs.readFileSync(TEST_IMAGE_PATH);

  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Date.now();
    const req = http.request(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    });

    let body = '';
    const fileSize = fileBuffer.length;

    // 构建 multipart body
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="test-image.jpg"\r\n`;
    body += `Content-Type: image/jpeg\r\n\r\n`;

    const headerBuffer = Buffer.from(body, 'utf8');
    const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

    req.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));

      // 模拟 Flutter 中错误的进度跟踪方式
      let bytesReceived = 0;
      res.on('data', (chunk) => {
        bytesReceived += chunk.length;
        // 这里的问题是：这是响应数据的进度，不是上传进度！
        log(`响应进度: ${bytesReceived} bytes`, 'yellow');
      });

      res.on('end', () => {
        log('问题：上面的"进度"其实是下载响应数据的进度，不是上传进度！', 'red');
        log(`响应状态: ${res.statusCode}`, 'yellow');
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', reject);

    // 一次性写入所有数据
    req.write(headerBuffer);
    req.write(fileBuffer);
    req.write(footerBuffer);
    req.end();

    log('上传已经一次性完成，无法在这个过程中跟踪进度！', 'red');
  });
}

// 测试方案4: 正确的方式 - 使用 HttpClient 流式上传
async function test4CorrectStreamUpload() {
  log('\n=== 测试4: 正确的流式上传方式 ===', 'blue');

  const fileBuffer = fs.readFileSync(TEST_IMAGE_PATH);
  const chunkSize = 50 * 1024; // 50KB per chunk for demo
  const totalChunks = Math.ceil(fileBuffer.length / chunkSize);

  log(`文件大小: ${(fileBuffer.length / 1024).toFixed(2)} KB`, 'yellow');
  log(`分块大小: ${(chunkSize / 1024).toFixed(2)} KB`, 'yellow');
  log(`总分块数: ${totalChunks}`, 'yellow');

  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Date.now();
    let uploadedBytes = 0;

    const req = http.request(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    });

    req.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        log(`上传完成！响应状态: ${res.statusCode}`, 'green');
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', reject);

    // 分块写入，跟踪进度
    const sendNextChunk = (chunkIndex) => {
      if (chunkIndex >= totalChunks) {
        // 写入结束标记
        req.write(`\r\n--${boundary}--\r\n`);
        req.end();
        return;
      }

      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.length);
      const chunk = fileBuffer.slice(start, end);

      if (chunkIndex === 0) {
        // 第一块：写入头部
        let header = `--${boundary}\r\n`;
        header += `Content-Disposition: form-data; name="file"; filename="test-image.jpg"\r\n`;
        header += `Content-Type: image/jpeg\r\n\r\n`;
        req.write(header);
      }

      req.write(chunk, () => {
        uploadedBytes += chunk.length;
        const progress = ((uploadedBytes / fileBuffer.length) * 100).toFixed(1);
        log(`上传进度: ${progress}% (${uploadedBytes}/${fileBuffer.length} bytes)`, 'green');

        // 模拟网络延迟，让进度更明显
        setTimeout(() => sendNextChunk(chunkIndex + 1), 50);
      });
    };

    sendNextChunk(0);
  });
}

// 主测试函数
async function runTests() {
  log('🧪 图片上传测试脚本', 'blue');
  log('====================', 'blue');

  try {
    // 创建测试图片
    createTestImage();

    // 需要有效的 JWT token 才能测试
    log('\n⚠️  注意：以下测试需要有效的 JWT token', 'yellow');
    log('请在代码中设置 TOKEN 变量', 'yellow');
    log('或者先登录获取 token', 'yellow');

    // 运行测试
    await test1FormDataUpload();
    await test2ChunkedUpload();
    await test3SimulateFlutterHttpPackage();
    await test4CorrectStreamUpload();

    log('\n✓ 所有测试完成', 'green');

    // 清理测试文件
    fs.unlinkSync(TEST_IMAGE_PATH);
    log('✓ 清理测试文件', 'green');

    // 输出结论
    log('\n==================== 结论 ====================', 'blue');
    log('问题原因:', 'yellow');
    log('  Flutter 的 http.MultipartRequest.send() 是一次性发送整个请求', 'white');
    log('  streamRes.stream 是响应流，不是上传流', 'white');
    log('  因此无法在上传过程中跟踪进度', 'white');
    log('\n解决方案:', 'green');
    log('  使用 HttpClient 实现流式上传', 'white');
    log('  参考 uploadVideo 方法的实现', 'white');
    log('=============================================\n', 'blue');

  } catch (error) {
    log(`\n✗ 测试失败: ${error.message}`, 'red');
    console.error(error);
  }
}

// 运行测试
runTests();
