import flask
import gspread
import json
import os # เพิ่ม os เข้ามา

# --- การตั้งค่า ---
# ตรวจสอบว่าเรากำลังรันบน Render หรือไม่
if 'GSPREAD_CREDENTIALS' in os.environ:
    # ถ้าใช่, ให้อ่านข้อมูลจาก Environment Variable
    creds_json = json.loads(os.environ['GSPREAD_CREDENTIALS'])
    sa = gspread.service_account_from_dict(creds_json)
else:
    # ถ้าไม่ใช่ (รันบนเครื่องตัวเอง), ให้อ่านจากไฟล์เหมือนเดิม
    sa = gspread.service_account(filename="credentials.json")

# !!! แก้ไขตรงนี้เป็นชื่อ Google Sheet ของคุณ !!!
sh = sa.open("Dashboard Data Q3") 
# !!! แก้ไขตรงนี้ถ้าชื่อชีทของคุณไม่ใช่ Sheet1 !!!
wks = sh.worksheet("DataCFM")

# --- สร้างเว็บแอปพลิเคชันด้วย Flask ---
app = flask.Flask(__name__)

@app.route("/")
def index():
    try:
        all_records = wks.get_all_records()
        return flask.render_template("index.html", data=all_records, page='report')
    except Exception as e:
        print(f"An error occurred on /: {e}")
        return flask.render_template("index.html", data=[], page='report')

@app.route("/analytics")
def analytics():
    try:
        all_records = wks.get_all_records()
        return flask.render_template("analytics.html", data=all_records, page='analytics')
    except Exception as e:
        print(f"An error occurred on /analytics: {e}")
        return flask.render_template("analytics.html", data=[], page='analytics')

# ส่วนนี้ไม่จำเป็นสำหรับการรันบน Render แต่เก็บไว้สำหรับรันบนเครื่องตัวเองได้
if __name__ == "__main__":
    app.run(debug=True, port=5001)
