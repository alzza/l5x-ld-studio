# 변경 이력

## 2026-09-16 — SFC 글자색 복구

- 문법 강조는 ST 루틴 원본 탭에만 적용한다. SFC 차트 글자는 원래 색을 유지한다.

## 2026-09-16 — ST 빈 줄 제거

- L5X `Line`이 비어 있거나 공백·nbsp만 있으면 번호 있는 빈 행으로 그리지 않는다.
- Structured Text는 실제 문장만 연속으로 보여 준다.

## 2026-09-16 — 새로고침 후 파일 유지

- 마지막으로 연 L5X와 붙여 넣은 RLL은 IndexedDB에 남기고, 새로고침해도 다시 연다.
- 파일은 이 브라우저 안에만 있고 서버로 올라가지 않는다. 상단 **닫기**로 지운다.
- 샘플 페이지(`demo.html`, `demo-sfc.html`)는 저장된 프로젝트를 덮어쓰지 않는다.

## 2026-09-16 — ST 줄 간격

- L5X에 들어 있는 빈 줄을 버리고, 편집기 줄 높이를 VS Code에 가깝게 줄인다.

## 2026-09-16 — ST 구문 강조

- Structured Text는 1756-PM007 키워드·주석·문자열·숫자를 나눠 VS Code Dark+ 색으로 표시한다.
- ST 루틴 원본 탭은 줄 번호가 있는 편집기 레이아웃을 쓴다.

## 2026-09-16 — SFC 글자 겹침

- 스텝·액션·트랜지션 글자는 L5X 좌표는 두고, 옆 도형까지 남은 폭 안에서만 줄바꿈한다.
- 긴 스텝 이름과 ST 조건이 이웃 상자를 덮지 않도록 상자 폭을 맞춘다.

## 2026-09-16 — 프로그램 목록 접기

- 왼쪽 Program 목록은 처음 열 때 모두 접힌다.
- `프로그램 목록 접기`로 기본 접힘/펼침을 바꾸고, 그 선택은 브라우저에 남는다.
- 루틴을 고를 때 목록을 다시 그리지 않아, 접어 둔 프로그램이 그대로 유지된다.

## 2026-09-16 — SFC 차트 뷰어

- SFC 루틴은 원본 XML 덤프 대신 Sequential Function Chart로 그린다.
- 위치는 L5X `X`/`Y`를 쓰고, `DirectedLink`로 연결한다.
- Step, Action, Transition, Selection/Simultaneous 분기, Stop, TextBox, SbrRet를 그린다.
- 액션 ST 본문은 스텝의 `ShowActions`를 따른다.
- 편집기는 넣지 않는다. 기준은 1756-PM006L이다.

## 2026-09-14 — 노트 실시간 렌더

- UI가 없는 페이지에서도 `L5XLadder.renderRung`만 불러 쓸 수 있다.
- 노트는 본문 폭이 바뀌면 Rung을 다시 그려 Studio 5000처럼 레일 폭을 맞춘다.

## 2026-09-14 — 최소 가로 유지(노트용)

- 툴바에 배율 옵션을 둔다. `시트 너비에 맞춤`은 화면 캔버스 폭으로 레일을 늘린다.
- `최소 가로 유지 · 노트용`은 Studio 5000처럼 짧은 Rung도 같은 레일 폭을 쓴다. 기본 최소 가로는 920px이다. 내용이 그보다 넓을 때만 SVG가 커지고, 노트에서는 한 화면에 맞게 줄어든다.

## 2026-09-14 — 캡처 SVG 좌우 여백

- 번호를 SVG 안에 넣지 않을 때는 왼쪽 72px 자리를 두지 않는다.
- 왼쪽 여백을 오른쪽과 같은 22px로 맞춘다.
- `viewportWidth`를 0으로 보내면 Rung을 내용 폭으로만 그린다. 노트처럼 가로로 늘려 볼 때 접점과 코일이 커진다.

## 2026-09-13 — Logix Designer형 전체 래더 출력

### 렌더링

- Routine을 개별 카드가 아니라 하나의 인쇄 시트처럼 표시한다.
- Routine 머리글에 이름, Program/Routine 경로, 전체 Rung 수, Page, 생성 시각을 표시한다.
- 각 Rung에 번호를 표시하고 좌우 전원 레일을 연속으로 배치한다.
- `(End)`와 `Logix Designer` 바닥글을 표시한다.
- 첫 병렬 Branch는 주 수평선에 두고 추가 Branch는 아래로 확장한다.
- 중첩 Branch도 같은 규칙으로 아래쪽에 배치한다.
- SVG와 브라우저 화면의 좌표를 동일하게 유지한다.

### 기호와 색상

- XIC는 Examine If Closed 형태의 두 세로 접점으로 표시한다.
- XIO는 XIC 접점에 대각선이 추가된 형태로 표시한다.
- OTE, OTL, OTU는 Rockwell식 코일 곡선과 L/U 표식을 사용한다.
- ONS, OSR, OSF, TON, TOF, RTO, CTU, CTD, MOV, EQU, LES, GRT, JSR 등은 명령 블록으로 표시한다.
- 기본 선은 Rockwell 청색 계열로 표시한다.
- 태그 상태가 주어지면 활성 접점·코일·경로를 녹색으로 강조한다.

### 전체 태그 보존

- 접점, 코일, 명령 블록의 태그 이름을 임의로 줄이지 않는다.
- `…` 말줄임을 사용하지 않는다.
- MOV/TON/EQU 등의 Source, Dest, Timer, Preset, Accum 값을 모두 출력한다.
- 태그 길이에 맞춰 명령 블록과 Rung의 자연 폭을 계산한다.
- 명령 블록 양쪽 연결선이 상자 내부에서 끊기지 않도록 폭을 제한하지 않는다.

### 상태 API

브라우저에서 상태값을 주입하면 활성 경로를 확인할 수 있다.

```js
L5XLadder.setTagValues({
  Start_PB: true,
  Stop_PB: false,
  Motor_Run: true
});
```

`XIC`는 값이 1일 때, `XIO`는 값이 0일 때 활성 색상으로 표시한다. 값이 제공되지 않은 태그는 원문 색상으로 유지한다.

## 2026-09-06 — 초기 공개 버전

- L5X XML의 Program/Routine/RLL 구조를 브라우저에서 파싱
- RLL 직렬 명령과 중첩 병렬 Branch를 LD SVG로 변환
- RLL Neutral Text 직접 입력 지원
- ST와 SFC는 LD로 변환하지 않고 원문과 원본 XML 구조를 보존
- SVG, TXT, 브라우저 인쇄/PDF 내보내기 지원
- 파서 경고와 미지원 명령을 변환 리포트에서 확인

## 기준 문서

기호와 Branch 배치는 Rockwell Automation의 [Logix 5000 Controllers Ladder Diagram Programming Manual, 1756-PM008J-EN-P](https://literature.rockwellautomation.com/idc/groups/literature/documents/pm/1756-pm008_-en-p.pdf) Chapter 1을 기준으로 한다.
