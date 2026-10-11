import {readCloudConfig} from '../cloud/config.mjs';
try {
  const config = readCloudConfig(process.env);
  if (!config.ready) {
    console.log(`연결 준비 중: ${config.missing.join(', ')} 설정이 필요합니다. 값이나 비밀 키는 출력하지 않습니다.`);
    process.exitCode = 1;
  } else {
    console.log('필수 환경변수 형식 확인 완료. 실제 계정·로그인·DB·캡처 연결 검증은 별도입니다.');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
