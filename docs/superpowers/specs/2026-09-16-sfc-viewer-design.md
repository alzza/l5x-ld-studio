# L5X SFC 뷰어 설계

날짜: 2026-09-16  
저장소: `alzza/l5x-ld-studio`  
상태: 대화에서 확정한 내용을 문서로 고정한다.

## 목표

Studio 5000 Logix Designer에서보낸 `.L5X`의 SFC 루틴을 브라우저에서 차트로 그린다. 그림은 Rockwell 매뉴얼과 L5X에 저장된 좌표를 따른다. 편집은 하지 않는다.

기준 문서:

- [Logix 5000 Controllers Sequential Function Charts, 1756-PM006L-EN-P](https://literature.rockwellautomation.com/idc/groups/literature/documents/pm/1756-pm006_-en-p.pdf)
- L5X 스키마 `SFCContentType` (v32 이상): Step, Transition, Branch, SbrRet, Stop, DirectedLink, TextBox, Attachment

## 하지 않는 일

- 스텝·분기를 화면에서 추가하거나 옮기는 편집기
- SFC 텍스트를 붙여 넣어 차트를 만드는 입력
- ST 루틴을 차트로 바꾸는 일
- 액션이 호출하는 서브루틴 SFC를 같은 시트에 펼치는 일
- 노트 사이트 `alzza.github.io`에 SFC 임베드를 넣는 일
- 공장·고객 L5X를 이 저장소에 넣는 일
- 그래프 라이브러리로 좌표를 다시 계산하는 일

## 구조

새 파일은 `sfc.js` 하나다. `app.js`는 SFC 루틴을 고르면 이 모듈만 호출한다. 래더 파서와 렌더러는 그대로 둔다.

흐름:

1. 기존처럼 L5X를 브라우저에서 읽는다. 서버로 보내지 않는다.
2. `Routine Type="SFC"`이면 `SFCContent`를 파싱한다.
3. `L5XLadder.renderSFC(chart)`가 흰 시트 SVG를 만든다.
4. 스튜디오 캔버스는 래더와 같은 확대·인쇄·SVG 보내기를 쓴다.
5. 원본 로직 탭은 지금처럼 루틴 XML을 보여 준다.

공개 API:

```js
L5XLadder.parseSFC(routineElement) -> chart
L5XLadder.renderSFC(chart) -> { svg, width, height, warnings }
```

`window.L5XLadder`에 위 두 함수를 더한다. UI가 없는 페이지에서도 호출할 수 있어야 한다.

## 데이터

파서가 남기는 차트 객체는 L5X 이름을 유지한다.

| L5X 요소 | 필수 속성 | 비고 |
|---|---|---|
| `SFCContent` | `SheetSize`, `SheetOrientation` | 시트 크기·방향 |
| `Step` | `ID`, `X`, `Y` | `Operand`, `InitialStep`, `ShowActions`, `HideDesc`, Action 목록 |
| `Action` | `ID` | `Operand`, `Qualifier`, `IsBoolean`, `Body` ST, `Preset` |
| `Transition` | `ID`, `X`, `Y` | `Operand`, `Condition` ST, `Force` |
| `Branch` | `ID`, `Y`, `BranchType`, `BranchFlow` | `Selection`/`Simultaneous`, `Diverge`/`Converge`, `Leg` |
| `DirectedLink` | `FromID`, `ToID`, `Show` | 연결. `Show=false`는 점프 화살표 |
| `Stop` | `ID`, `X`, `Y` | `Operand` |
| `TextBox` | 스키마의 위치·텍스트 | 설명 상자 |
| `SbrRet` | `ID`, `X`, `Y` | `In`, `Ret` |
| `Attachment` | 스키마대로 | 있으면 연결만 반영하고, 모르는 형태는 경고 |

한정자 표시는 매뉴얼 약어를 쓴다. `NonStored`와 `N`은 둘 다 `N`으로 그린다. `S`, `R`, `L`, `D`, `P`, `P1`, `P0`, `SL`, `SD`, `DS`도 같다. 목록에 없는 값은 경고하고 원문 문자열을 상자에 쓴다.

ST 본문은 `Body/STContent/Line`과 `Condition/STContent/Line`을 줄 순서대로 이어 붙인다.

## 기호

색: 배경 `#fff`, 선 `#243b7a`, 글자 `#111`, 조건·ST 본문은 Logix처럼 적갈색 계열. 다크 테마여도 차트는 흰 종이 위에 올린다.

- **Step**: 둥근 사각형. 가운데 `Operand`. `InitialStep`이면 왼쪽 위를 이중선으로 구분해 초기 스텝임을 나타낸다. 위·아래 핀이 연결점이다.
- **Action**: 스텝 오른쪽. 첫 칸은 한정자와 액션 이름, 다음 칸은 ST 본문. `ShowActions`가 꺼져 있으면 이름·한정자만 그린다. Boolean 액션은 본문 없이 이름만 둔다. `JSR(...)`는 글자로만 보이고 그 루틴을 이 시트에 펼치지 않는다.
- **Transition**: 짧은 가로 막대와 아래쪽 삼각. 옆에 이름, 아래 또는 옆에 조건 ST.
- **Selection 분기**: 가로선 하나. 트랜지션은 가로선 안쪽이다.
- **Simultaneous 분기**: 가로선 둘. 트랜지션은 가로선 바깥쪽이다.
- **DirectedLink**: `FromID`에서 `ToID`로 수직·수평만 쓴다. 대각선은 쓰지 않는다. `Show=false`이면 되돌리는 점프 화살표로 그린다.
- **Stop**: 아래가 열린 막대 기호와 이름.
- **TextBox**: 점선 설명 상자.
- **SbrRet**: `In`/`Ret`를 그대로 표시하는 입·출 상자.

요소의 기준점은 L5X `X`, `Y`다. SVG 사용자 단위로 쓰되, 상자 크기와 맞추는 고정 배율 상수만 둔다. 요소마다 다른 배율은 쓰지 않고, 좌표를 다시 계산하지 않는다. 상자의 폭·높이는 글자 길이와 `ShowActions`에 따라 커질 수 있다.

시트 크기와 방향은 `SheetSize`, `SheetOrientation`을 따른다.

## 화면

루틴 트리에서 SFC를 고르면 캔버스가 SFC 시트를 연다. 탭은 차트 / 원본 로직 / 변환 리포트다.

툴바의 확대, 인쇄·PDF, SVG 보내기는 SFC 시트에도 동작한다. SVG에는 차트만 들어간다. TXT 보내기는 스텝·트랜지션·액션 이름과 ST 본문을 텍스트로 적는다.

배율 옵션 「최소 가로 유지 · 노트용」은 래더 전용이므로 SFC에서는 숨긴다.

변환 리포트에는 스텝·트랜지션·분기·링크 수와 경고를 적는다. 경고가 있어도 그릴 수 있는 요소는 그린다.

샘플 `demo.html`은 지금 RLL을 유지한다. SFC 샘플 L5X는 공개 가능한 것이 있을 때만 나중에 추가한다.

## 오류

- L5X가 아니거나 XML이 깨지면 지금처럼 파일 읽기 오류다.
- SFC인데 `SFCContent`가 없으면 빈 시트와 경고다.
- `ID`가 없거나 `X`/`Y`가 없는 요소는 그리지 않고 경고한다.
- `DirectedLink`가 없는 ID를 가리키면 그 선만 빼고 경고한다.
- 모르는 `Qualifier`·`BranchType`·`BranchFlow`는 원문을 표시하고 경고한다.

실행 시뮬레이터, 강제(Force) 애니메이션, 온라인 태그는 1차에 넣지 않는다. `Force` 속성은 읽기만 하고 리포트에 적는다.

## 검증

- 스키마에 있는 요소를 최소 하나씩 담은 작은 픽스처 XML로 파서 단위를 확인한다. 공장 L5X는 커밋하지 않는다.
- 시퀀스, 선택 분기, 동시 분기, `Show=false` 링크, `ShowActions` 켜짐/꺼짐을 브라우저에서 눈으로 확인한다.
- SVG 보내기 결과에 차트 SVG가 있고 스튜디오 크롬이 없는 것을 확인한다.
- 기존 RLL 데모(`demo.html`)가 이전과 같이 그려지는 것을 확인한다.

## 수용 기준

- SFC 루틴을 고르면 XML 덤프 대신 차트가 보인다.
- 도형 위치는 L5X `X`/`Y`와 같다.
- 선택 분기는 가로선 하나, 동시 분기는 가로선 둘이다.
- 액션 ST 본문은 해당 스텝의 `ShowActions`를 따른다.
- 편집 도구가 없다.
- RLL 렌더와 `demo.html`이 깨지지 않는다.
- 다크 테마에서도 전선이 흰 종이 위에서 보인다.

## 파일

| 파일 | 역할 |
|---|---|
| `sfc.js` | 파서·렌더러 |
| `index.html` | `sfc.js` 로드, SFC일 때 배율 옵션 숨김 |
| `app.js` | SFC 루틴이면 `renderSFC` 호출, API 노출 |
| `app.css` | 시트·경고 최소 스타일 |
| `CHANGELOG.md` / `README.md` | SFC는 차트로 그린다고 수정 |
