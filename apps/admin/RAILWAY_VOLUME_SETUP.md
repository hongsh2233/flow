# Railway 영구 볼륨 설정 가이드

## 문제
빌드 후 배너 이미지가 초기화되는 문제는 Railway에서 컨테이너가 재빌드될 때 파일 시스템이 초기화되기 때문입니다.

## 해결 방법

### 방법 1: Railway 영구 볼륨 사용 (권장)

1. Railway 대시보드에서 프로젝트 선택
2. **Settings** → **Volumes** 섹션으로 이동
3. **New Volume** 클릭
4. 다음 설정으로 볼륨 생성:
   - **Name**: `uploads-volume`
   - **Mount Path**: `/workspace/uploads`
   - **Size**: 필요에 따라 설정 (예: 1GB)

5. 서비스 재배포

### 방법 2: 환경 변수로 업로드 경로 설정

외부 스토리지(S3, Cloud Storage)를 사용하는 경우:

1. Railway 환경 변수에 추가:
   - `UPLOAD_STORAGE_TYPE=s3` (또는 `local`)
   - `AWS_S3_BUCKET=your-bucket-name`
   - `AWS_ACCESS_KEY_ID=your-key`
   - `AWS_SECRET_ACCESS_KEY=your-secret`

2. 코드 수정하여 S3 업로드 지원 추가

### 방법 3: 빌드 시 디렉토리 생성 (임시 해결책)

Dockerfile에 디렉토리 생성 명령 추가 (이미 적용됨)

## 확인 사항

- [ ] Railway 볼륨이 올바르게 마운트되었는지 확인
- [ ] `/workspace/uploads` 경로에 쓰기 권한이 있는지 확인
- [ ] 배너 이미지 업로드 후 파일이 실제로 저장되는지 확인

## 참고

- Railway 볼륨은 프로젝트별로 생성되며, 서비스 재배포 시에도 데이터가 유지됩니다.
- 볼륨 크기는 필요에 따라 조정할 수 있습니다.
- 볼륨 마운트 후에는 서비스를 재배포해야 적용됩니다.

