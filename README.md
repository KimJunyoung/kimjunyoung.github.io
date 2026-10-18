# Network & Security Notes — Junyeong Kim

Personal technical blog for networking, Linux, and security operations. Articles describe the author's stated experience and learning plans; the first lab series is a plan, not a completed production project.

## 구조

- `content/posts/`: 공개할 영어 글. Markdown 형식입니다.
- `content/about.md`: 소개 페이지.
- `templates/lab-post.md`: 새 실습 글 양식. 초안을 공개하려면 실제 실습 결과로 채운 뒤 `draft: false`로 바꿉니다.
- `labs/`: 실습 가이드와 추후 직접 만든 `.pkt`·구성 파일. 포함된 한국어 가이드는 설계안이며 실행 검증된 `.pkt` 파일이 아닙니다.
- `assets/`: 디자인과 작은 화면용 메뉴.
- `dist/`: 빌드 결과. 자동 생성되므로 직접 수정하지 않습니다.

## 글 추가하기

1. `templates/lab-post.md`를 복사해 `content/posts/YYYY-MM-DD-your-topic.md`로 저장합니다.
2. 제목·요약·날짜·고유 slug를 수정하고, 실제 확인한 내용을 작성합니다.
3. 필요한 실습 파일은 `labs/`에 넣고 본문에서 링크합니다. 글은 `/posts/slug/` 경로이므로 루트 labs 파일의 상대 링크는 `../../labs/파일명`입니다.
4. 준비된 글만 `draft: false`로 바꾸고 `main`에 저장합니다. GitHub Pages workflow가 자동 빌드·배포합니다.

## 로컬 미리보기

Node.js 20 이상에서:

```text
npm install
npm run build
python3 -m http.server 4173 --directory dist
```

브라우저에서 `http://localhost:4173`을 엽니다.

## GitHub Pages 설정

새 공개 저장소에 이 폴더의 소스를 넣고, 저장소 Settings → Pages → Source를 **GitHub Actions**로 선택합니다. `main`에 저장하거나 Actions → Publish blog → Run workflow를 실행합니다.

프로젝트 저장소 경로와 공개 주소는 workflow에서 자동 반영합니다. 기존 Pages 저장소가 있다면 덮어쓰지 않고 별도 프로젝트 저장소를 사용합니다.

플랫폼 공식 설명: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 글을 LinkedIn에 공유하기

완료한 실습을 블로그에 게시한 뒤, 증상·핵심 근거·복구 검증·배운 점을 짧게 요약하고 실제 원문 주소를 붙입니다. 직장 내부 자료는 개인 저장소에 올리지 않습니다.
