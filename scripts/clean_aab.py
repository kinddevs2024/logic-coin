import zipfile
src = r"C:\Users\MyPc\Documents\Logic-coin\frontend\android\app\build\outputs\bundle\release\logic-coin.aab"
out = r"C:\Users\MyPc\Documents\Logic-coin\frontend\android\app\build\outputs\bundle\release\logic-coin-clean.aab"
with zipfile.ZipFile(src, 'r') as zin:
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            name = item.filename
            if name.upper().startswith('META-INF/ANDROIDD'):
                # skip Android Debug signature files
                continue
            data = zin.read(item.filename)
            zout.writestr(item, data)
print('cleaned to', out)
