# Vercel 배포 가이드

이 프로젝트는 **Next.js**이므로 Vercel에서 **추가 설정 파일 없이** 배포할 수 있습니다.

## 1. 준비

- GitHub(또는 GitLab/Bitbucket)에 저장소를 올려 두세요.
- 로컬에서 `npm run predeploy`(lint + build)가 통과하는지 확인하세요.

## 2. Vercel에 프로젝트 연결

1. [vercel.com](https://vercel.com) 로그인 → **Add New… → Project**
2. 저장소 **Import**
3. Framework Preset: **Next.js** (자동 인식)
4. **Deploy** (환경 변수는 다음 단계에서 넣어도 되고, 첫 배포 후 넣고 재배포해도 됩니다)

## 3. 환경 변수 (Project → Settings → Environment Variables)

`.env.example`을 참고해 아래를 등록합니다.

| 변수 | Environment | 비고 |
|------|-------------|------|
| `GEMINI_API_KEY` | Production, Preview | 분석에 필수 |
| `GEMINI_MODEL` | Production, Preview | 비우면 기본 모델 |
| `NEXT_PUBLIC_SITE_URL` | Production, Preview | 프로덕션 URL, 예: `https://프로젝트명.vercel.app` 또는 커스텀 도메인 |
| `SITE_PASSWORD` | Production, Preview | 사이트 잠금 시 |
| `AUTH_SECRET` | Production, Preview | 잠금 시 권장(긴 랜덤 문자열) |
| `GOOGLE_API_KEY` | 선택 | Studio 대신 Cloud 키만 있을 때 |
| `NEXT_PUBLIC_ALLOW_INDEXING` | 선택 | 검색 색인 허용 시 `1` |

- **Sensitive**로 표시할 항목: `GEMINI_API_KEY`, `SITE_PASSWORD`, `AUTH_SECRET`, `GOOGLE_API_KEY` 등
- `NEXT_PUBLIC_*` 는 **빌드 시** 주입됩니다. 값을 바꾼 뒤에는 **Redeploy**가 필요합니다.
- 서버 전용 변수(`GEMINI_*` 등)를 바꾼 뒤에도 재배포하면 반영됩니다.

Vercel은 기본 **HTTPS**이므로 로그인 쿠키(`Secure`)와 메타데이터에 맞게 `NEXT_PUBLIC_SITE_URL`을 **`https://`로 시작하는 실제 주소**로 두는 것이 좋습니다.

## 4. 배포 후 확인

- 프로덕션 URL로 접속해 메인·로그인(잠금 시)·분석 한 번씩 테스트
- **Settings → Domains**에서 커스텀 도메인 연결 가능
- 도메인을 바꾸면 `NEXT_PUBLIC_SITE_URL`도 같이 수정 후 재배포

## 5. 로컬에서 Vercel CLI (선택)

```bash
npm i -g vercel
vercel login
vercel link   # 프로젝트 연결
vercel env pull .env.local   # 원격 환경 변수 받기 (선택)
```

## 6. 참고

- 미들웨어 관련 Next 16 경고는 [middleware → proxy](https://nextjs.org/docs/messages/middleware-to-proxy) 문서를 나중에 검토하면 됩니다.
- Self-hosted용 `npm run start`는 Vercel에서는 사용하지 않습니다(Vercel이 빌드·실행을 처리).
