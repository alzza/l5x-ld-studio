# L5X Ladder Studio

Studio 5000 `.L5X` 파일을 브라우저에서 읽어 RLL 루틴을 래더 다이어그램(LD)으로 재구성하는 오프라인 웹 도구입니다.

**Live:** https://alzza.github.io/l5x-ld-studio/

샘플 래더: https://alzza.github.io/l5x-ld-studio/demo.html

파일은 서버로 전송되지 않습니다. 파싱·렌더는 전부 브라우저 안에서 끝납니다.

## 실행

1. [라이브 페이지](https://alzza.github.io/l5x-ld-studio/)를 열거나 `index.html`을 Chrome / Edge / Safari에서 엽니다.
2. **L5X 열기** 또는 왼쪽 영역으로 `.L5X`를 끌어 놓습니다.
3. Program · Routine을 선택해 Ladder, 원본 로직, 변환 리포트를 확인합니다.
4. SVG / TXT / 인쇄·PDF로 내보냅니다.

L5X가 없어도 **RLL 텍스트 → LD**에 Rockwell Neutral Text를 붙여 넣을 수 있습니다.

```
XIC(Start_PB)XIO(Stop_PB)OTE(Motor_Run);
```

## 최근 변경 기능

전체 변경 내역은 [`CHANGELOG.md`](CHANGELOG.md)에 기록했습니다.

- Rockwell Logix Designer 인쇄물에 가까운 Routine 전체 시트 레이아웃
- 첫 Branch는 주 수평선에 유지하고 병렬·중첩 Branch는 아래 방향으로 확장
- XIC/XIO/OTE/OTL/OTU 접점·코일 기호와 좌우 전원 레일 개선
- Rung 번호, Page, 날짜, Routine 정보, `(End)` 표시 추가
- MOV/TON/EQU 등 Function 블록의 Source·Dest·Timer·Preset·Accum 전체 태그 보존
- 긴 태그의 `…` 생략 제거 및 태그 길이에 따른 블록·Rung 자연 폭 확장
- 블록 좌우 연결선이 명령 상자에서 잘리지 않도록 자연 폭 계산
- `L5XLadder.setTagValues({...})`로 XIC/XIO/코일 활성 상태를 녹색으로 표시
- 화면·SVG·인쇄/PDF가 같은 래더 좌표를 사용

## 지원

- RLL: 직렬 명령, 중첩 병렬 분기, XIC/XIO, OTE/OTL/OTU, ONS/OSR/OSF, 타이머·카운터·비교·이동·호출 계열
- ST / SFC: LD로 변환하지 않고 원문·원본 XML을 그대로 표시
- 내보내기: SVG, TXT, 브라우저 인쇄/PDF
- 레이아웃: Rockwell 매뉴얼 기준의 수평 주선·하향 Branch·연속 전원 레일
- 태그 표시: 원문 전체를 보존하며 임의 생략하지 않음

## 정확도

래더 변환 대상은 RLL 루틴과 직접 입력한 RLL Neutral Text뿐입니다. ST와 SFC는 의미나 실행 순서를 바꾸지 않도록 LD로 바꾸지 않습니다.

## 로컬 파일

| 파일 | 역할 |
|------|------|
| `index.html` | 스튜디오 |
| `demo.html` | 범용 모터 스타터 샘플 자동 로드 |
| `app.js` / `app.css` | 파서·렌더러 |
| `sample.rll` | 샘플 Neutral Text |

Plant / 고객 프로젝트 L5X는 이 저장소에 포함하지 않습니다.

## License

MIT
