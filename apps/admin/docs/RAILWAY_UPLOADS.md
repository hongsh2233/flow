# Railway 배포 시 업로드 이미지 유지

Railway는 **재배포 시 컨테이너가 새로 만들어지기 때문에** 컨테이너 내부의 `uploads/` 폴더에 저장된 파일(배너, 팝업, 게시판 첨부 등)이 사라집니다.  
그래서 빌드/배포 후에는 이미지가 깨져 보일 수 있습니다.

## 해결 방법

### 1. Railway Volume 사용 (권장)

1. Railway 대시보드에서 해당 서비스 선택
2. **Variables** 탭이 아닌 **Volumes** 탭으로 이동
3. **New Volume** 추가 후, 마운트 경로를 앱의 `uploads` 디렉터리와 동일하게 설정  
   - 예: Mount Path = `/app/uploads` (실제 앱의 `BASE_DIR/uploads`가 되는 경로)
4. 앱에서 `UPLOADS_DIR`이 이 경로를 가리키도록 설정  
   - 이미 `config.UPLOADS_DIR = BASE_DIR / "uploads"` 이므로, Docker/실행 시 작업 디렉터리를 앱 루트로 두고 Volume을 `./uploads` 또는 해당 절대 경로에 마운트하면 됩니다.

### 2. Dockerfile에서 Volume 마운트

Railway에서 Dockerfile로 배포하는 경우, Dockerfile에는 Volume을 선언만 하고, Railway 쪽에서 Volume을 생성·연결해야 합니다.

```dockerfile
VOLUME ["/app/uploads"]
```

실제 경로는 `BASE_DIR`(앱 루트) 기준이므로, 앱이 `/app`에서 실행된다면 `/app/uploads`가 됩니다.

### 3. 외부 스토리지(S3 등) 사용

업로드 파일을 DB에 경로만 두고, 실제 파일은 S3 등 외부 스토리지에 저장하도록 구현을 바꾸면 재배포와 무관하게 이미지를 유지할 수 있습니다. (별도 구현 필요)

---

**요약**: Railway에서 이미지가 배포 후마다 깨진다면, **Volume**으로 `uploads` 디렉터리를 영구 디스크에 연결해야 합니다.
