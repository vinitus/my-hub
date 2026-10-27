"""기상청 공식 활용가이드 ZIP에서 국내 시도/시군구/읍면동 좌표를 JSON으로 추출한다.

외부 패키지 없이 읽기만 수행한다. 원본 XLSX를 수정하지 않는다.
python scripts/import-korean-weather-regions.py <official-guide.zip>
"""

import hashlib
import io
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

SOURCE_URL = "https://www.data.go.kr/data/15084084/openapi.do"
DOWNLOAD_URL = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000007732424&fileDetailSn=1"


def convert(archive: Path) -> dict:
    with zipfile.ZipFile(archive) as bundle:
        candidates = [name for name in bundle.namelist() if name.endswith(".xlsx")]
        if len(candidates) != 1:
            raise ValueError("좌표 XLSX 파일 하나가 필요합니다.")
        filename = candidates[0]
        payload = bundle.read(filename)
    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(payload)) as book:
        strings = ["".join(item.itertext()) for item in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("s:si", ns)]
        rows = ET.fromstring(book.read("xl/worksheets/sheet1.xml")).findall("s:sheetData/s:row", ns)

        def cells(row):
            values = {}
            for cell in row:
                value = cell.find("s:v", ns)
                values[re.sub(r"\d", "", cell.get("r"))] = "" if value is None else strings[int(value.text)] if cell.get("t") == "s" else value.text
            return values

        header = cells(rows[0])
        for column, label in {"B": "행정구역코드", "C": "1단계", "D": "2단계", "E": "3단계", "N": "경도(초/100)", "O": "위도(초/100)"}.items():
            if header.get(column) != label:
                raise ValueError(f"원본 열 구조가 변경되었습니다: {column}")
        regions = []
        for row in rows[1:]:
            values = cells(row)
            if values.get("A") != "kor" or not values.get("C"):
                continue
            code = values["B"]
            latitude, longitude = float(values["O"]), float(values["N"])
            # 원본의 이어도 항목은 위경도가 모두 0인 격자 전용 지점이다.
            if latitude == 0 and longitude == 0:
                continue
            if not re.fullmatch(r"\d{10}", code) or not (33 <= latitude <= 39.5 and 124 <= longitude <= 132):
                raise ValueError(f"잘못된 지역 코드 또는 좌표: {code}")
            regions.append({"code": code, "province": values["C"], "district": values.get("D", ""), "locality": values.get("E", ""), "latitude": round(latitude, 7), "longitude": round(longitude, 7)})
    if len({region["code"] for region in regions}) != len(regions):
        raise ValueError("중복된 행정구역 코드입니다.")
    # 행정구역 통합/개편으로 시도 수가 달라져도 원본의 현행 명칭을 유지한다.
    if sum(not region["district"] and not region["locality"] for region in regions) < 10:
        raise ValueError("시도 대표 좌표가 부족합니다. 원본 구조를 확인해 주세요.")
    if not any(region["locality"] for region in regions):
        raise ValueError("읍면동 좌표가 없습니다. 원본 구조를 확인해 주세요.")
    return {"source": {"provider": "기상청", "page": SOURCE_URL, "download": DOWNLOAD_URL, "file": filename, "sha256": hashlib.sha256(payload).hexdigest(), "license": "공공누리 제1유형: 출처표시"}, "regions": regions}


if __name__ == "__main__":
    result = convert(Path(sys.argv[1]))
    output = Path(__file__).resolve().parents[1] / "src/main/data/korean-weather-regions.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(result['regions'])} regions -> {output}")
