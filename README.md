# 대화 무드 분석

대화를 **통째로 붙여 넣으면** 발화자를 나눈 뒤, **Google Gemini**로 관계·무드·역동을 정리합니다. 서버에는 **`GEMINI_API_KEY`**(필수)를 넣습니다. Google Cloud 등에서 받은 키만 있으면 `GOOGLE_API_KEY`로도 동작합니다. **`docs/ai-analysis-rules.md`** 가 시스템 프롬프트에 포함됩니다(텍스트는 서버로 전송).

## 실행

```bash
npm install
npm run dev
```

## 본인만 쓰게 잠그기 (선택)

`.env.local`에 다음을 넣으면, 암호를 아는 사람만 사이트를 볼 수 있습니다.

```env
SITE_PASSWORD=길고_남들이_모르는_문자열
# 선택: 쿠키 서명용. 없으면 SITE_PASSWORD로 서명합니다.
AUTH_SECRET=
```

`SITE_PASSWORD`를 **비우면** 잠금이 꺼져 있어 로컬 개발처럼 누구나 접속할 수 있습니다.

## AI API 키 (Gemini)

프로젝트 **루트**에 `.env.local`을 만들고(이 파일은 git에 올라가지 않습니다), **[Google AI Studio](https://aistudio.google.com/apikey)** 에서 받은 키를 넣습니다.

```env
GEMINI_API_KEY=여기에_붙여넣기
```

- 모델은 `GEMINI_MODEL`로 바꿀 수 있고, 비우면 **`gemini-2.0-flash`** 입니다. 예전 이름(`gemini-1.5-pro` 등)은 API에서 **404**가 나는 경우가 있습니다. **429(할당량)** 이면 잠시 뒤 재시도하거나 Studio에서 한도를 확인하세요.
- Studio 키 대신 Cloud 등의 키만 있을 때는 `GOOGLE_API_KEY=` 로 같은 역할을 할 수 있습니다.
- **Gemini 키가 전혀 없을 때만** `OPENAI_API_KEY`로 대체 호출됩니다(보통은 넣지 않아도 됩니다).

키를 바꾼 뒤에는 `npm run dev`를 **다시 실행**해야 합니다.

## 참고

- 진단·채용·법적 판단에 사용할 수 없습니다.
