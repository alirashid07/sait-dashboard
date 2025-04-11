from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
from pdfminer.high_level import extract_text
from docx import Document
import ollama
import os
from minio import Minio
from minio.error import S3Error
import re
import spacy
from typing import List, Dict, Any
import sqlite3
import json
from datetime import datetime
from langdetect import detect
from googletrans import Translator, LANGUAGES
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MinIO Setup
try:
    minio_client = Minio("localhost:9000", access_key="minioadmin", secret_key="minioadmin", secure=False)
    bucket_name = "documents"
    if not minio_client.bucket_exists(bucket_name):
        minio_client.make_bucket(bucket_name)
except S3Error as e:
    print(f"MinIO Error: {e}")
    raise Exception("Failed to connect to MinIO server.")
except Exception as e:
    print(f"Unexpected Error: {e}")
    raise Exception("An unexpected error occurred.")

# Reports Database Setup
conn = sqlite3.connect("reports.db", check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id TEXT,
        compliance_type TEXT,
        report JSON,
        suggestions JSON,
        timestamp TEXT
    )
""")
conn.commit()

# Users Database Setup
user_conn = sqlite3.connect("users.db", check_same_thread=False)
user_cursor = user_conn.cursor()
user_cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT
    )
""")
user_conn.commit()

def load_spacy_model(model_name: str, fallback: str = "en_core_web_sm") -> spacy.language.Language:
    try:
        return spacy.load(model_name)
    except OSError:
        print(f"Warning: Model '{model_name}' not found. Falling back to '{fallback}'.")
        return spacy.load(fallback)

SPACY_MODELS = {
    "en": load_spacy_model("en_core_web_sm"),
    "es": load_spacy_model("es_core_news_sm"),
    "fr": load_spacy_model("fr_core_news_sm"),
    "ar": load_spacy_model("xx_ent_wiki_sm"),
}
translator = Translator()

GRI_STANDARDS = {
    "GRI": {
        "GRI 2: General Disclosures 2021": [
            {"disclosure": "2-1", "title": "Organizational details", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-2", "title": "Entities included in the organization’s sustainability reporting", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-3", "title": "Reporting period, frequency and contact point", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-4", "title": "Restatements of information", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-5", "title": "External assurance", "weight": 0.9, "mandatory": False},
            {"disclosure": "2-6", "title": "Activities, value chain and other business relationships", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-7", "title": "Employees", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-8", "title": "Workers who are not employees", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-9", "title": "Governance structure and composition", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-10", "title": "Nomination and selection of the highest governance body", "weight": 0.9, "mandatory": False},
            {"disclosure": "2-11", "title": "Chair of the highest governance body", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-12", "title": "Role of the highest governance body in overseeing the management of impacts", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-13", "title": "Delegation of responsibility for managing impacts", "weight": 0.9, "mandatory": False},
            {"disclosure": "2-14", "title": "Role of the highest governance body in sustainability reporting", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-15", "title": "Conflicts of interest", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-16", "title": "Communication of critical concerns", "weight": 0.9, "mandatory": False},
            {"disclosure": "2-17", "title": "Collective knowledge of the highest governance body", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-18", "title": "Evaluation of the performance of the highest governance body", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-19", "title": "Remuneration policies", "weight": 0.9, "mandatory": False},
            {"disclosure": "2-20", "title": "Process to determine remuneration", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-21", "title": "Annual total compensation ratio", "weight": 0.7, "mandatory": False},
            {"disclosure": "2-22", "title": "Statement on sustainable development strategy", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-23", "title": "Policy commitments", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-24", "title": "Embedding policy commitments", "weight": 0.9, "mandatory": False},
            {"disclosure": "2-25", "title": "Processes to remediate negative impacts", "weight": 0.9, "mandatory": False},
            {"disclosure": "2-26", "title": "Mechanisms for seeking advice and raising concerns", "weight": 0.8, "mandatory": False},
            {"disclosure": "2-27", "title": "Compliance with laws and regulations", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-28", "title": "Membership associations", "weight": 0.7, "mandatory": False},
            {"disclosure": "2-29", "title": "Approach to stakeholder engagement", "weight": 1.0, "mandatory": True},
            {"disclosure": "2-30", "title": "Collective bargaining agreements", "weight": 0.8, "mandatory": False},
        ],
        "GRI 3: Material Topics 2021": [
            {"disclosure": "3-1", "title": "Process to determine material topics", "weight": 1.0, "mandatory": True},
            {"disclosure": "3-2", "title": "List of material topics", "weight": 1.0, "mandatory": True},
            {"disclosure": "3-3", "title": "Management of material topics", "weight": 1.0, "mandatory": True},
        ],
        "GRI 101: Biodiversity 2024": [
            {"disclosure": "101-1", "title": "Direct drivers of biodiversity loss", "weight": 0.9, "mandatory": False},
            {"disclosure": "101-2", "title": "Impacts on biodiversity", "weight": 1.0, "mandatory": True},
            {"disclosure": "101-3", "title": "Management of biodiversity impacts", "weight": 0.9, "mandatory": False},
            {"disclosure": "101-4", "title": "Biodiversity protection commitments", "weight": 0.8, "mandatory": False},
        ],
        "GRI 201: Economic Performance 2016": [
            {"disclosure": "201-1", "title": "Direct economic value generated and distributed", "weight": 1.0, "mandatory": True},
            {"disclosure": "201-2", "title": "Financial implications and other risks and opportunities due to climate change", "weight": 0.9, "mandatory": False},
            {"disclosure": "201-3", "title": "Defined benefit plan obligations and other retirement plans", "weight": 0.8, "mandatory": False},
            {"disclosure": "201-4", "title": "Financial assistance received from government", "weight": 0.7, "mandatory": False},
        ],
        "GRI 205: Anti-corruption 2016": [
            {"disclosure": "205-1", "title": "Operations assessed for risks related to corruption", "weight": 0.9, "mandatory": False},
            {"disclosure": "205-2", "title": "Communication and training about anti-corruption policies and procedures", "weight": 1.0, "mandatory": True},
            {"disclosure": "205-3", "title": "Confirmed incidents of corruption and actions taken", "weight": 1.0, "mandatory": True},
        ],
        "GRI 302: Energy 2016": [
            {"disclosure": "302-1", "title": "Energy consumption within the organization", "weight": 1.0, "mandatory": True},
            {"disclosure": "302-2", "title": "Energy consumption outside of the organization", "weight": 0.8, "mandatory": False},
            {"disclosure": "302-3", "title": "Energy intensity", "weight": 0.9, "mandatory": False},
            {"disclosure": "302-4", "title": "Reduction of energy consumption", "weight": 0.9, "mandatory": False},
            {"disclosure": "302-5", "title": "Reductions in energy requirements of products and services", "weight": 0.8, "mandatory": False},
        ],
        "GRI 303: Water and Effluents 2018": [
            {"disclosure": "303-1", "title": "Interactions with water as a shared resource", "weight": 1.0, "mandatory": True},
            {"disclosure": "303-2", "title": "Management of water discharge-related impacts", "weight": 0.9, "mandatory": False},
            {"disclosure": "303-3", "title": "Water withdrawal", "weight": 1.0, "mandatory": True},
            {"disclosure": "303-4", "title": "Water discharge", "weight": 0.9, "mandatory": False},
            {"disclosure": "303-5", "title": "Water consumption", "weight": 1.0, "mandatory": True},
        ],
        "GRI 305: Emissions 2016": [
            {"disclosure": "305-1", "title": "Direct (Scope 1) GHG emissions", "weight": 1.0, "mandatory": True},
            {"disclosure": "305-2", "title": "Energy indirect (Scope 2) GHG emissions", "weight": 1.0, "mandatory": True},
            {"disclosure": "305-3", "title": "Other indirect (Scope 3) GHG emissions", "weight": 0.9, "mandatory": False},
            {"disclosure": "305-4", "title": "GHG emissions intensity", "weight": 0.9, "mandatory": False},
            {"disclosure": "305-5", "title": "Reduction of GHG emissions", "weight": 0.9, "mandatory": False},
            {"disclosure": "305-6", "title": "Emissions of ozone-depleting substances (ODS)", "weight": 0.8, "mandatory": False},
            {"disclosure": "305-7", "title": "Nitrogen oxides (NOx), sulfur oxides (SOx), and other significant air emissions", "weight": 0.8, "mandatory": False},
        ],
        "GRI 401: Employment 2016": [
            {"disclosure": "401-1", "title": "New employee hires and employee turnover", "weight": 1.0, "mandatory": True},
            {"disclosure": "401-2", "title": "Benefits provided to full-time employees that are not provided to temporary or part-time employees", "weight": 0.8, "mandatory": False},
            {"disclosure": "401-3", "title": "Parental leave", "weight": 0.9, "mandatory": False},
        ],
        "GRI 403: Occupational Health and Safety 2018": [
            {"disclosure": "403-1", "title": "Occupational health and safety management system", "weight": 1.0, "mandatory": True},
            {"disclosure": "403-2", "title": "Hazard identification, risk assessment, and incident investigation", "weight": 1.0, "mandatory": True},
            {"disclosure": "403-3", "title": "Occupational health services", "weight": 0.9, "mandatory": False},
            {"disclosure": "403-4", "title": "Worker participation, consultation, and communication on occupational health and safety", "weight": 0.9, "mandatory": False},
            {"disclosure": "403-5", "title": "Worker training on occupational health and safety", "weight": 0.9, "mandatory": False},
            {"disclosure": "403-6", "title": "Promotion of worker health", "weight": 0.8, "mandatory": False},
            {"disclosure": "403-7", "title": "Prevention and mitigation of occupational health and safety impacts directly linked by business relationships", "weight": 0.8, "mandatory": False},
            {"disclosure": "403-8", "title": "Workers covered by an occupational health and safety management system", "weight": 1.0, "mandatory": True},
            {"disclosure": "403-9", "title": "Work-related injuries", "weight": 1.0, "mandatory": True},
            {"disclosure": "403-10", "title": "Work-related ill health", "weight": 0.9, "mandatory": False},
        ],
        "GRI 404: Training and Education 2016": [
            {"disclosure": "404-1", "title": "Average hours of training per year per employee", "weight": 1.0, "mandatory": True},
            {"disclosure": "404-2", "title": "Programs for upgrading employee skills and transition assistance programs", "weight": 0.9, "mandatory": False},
            {"disclosure": "404-3", "title": "Percentage of employees receiving regular performance and career development reviews", "weight": 0.9, "mandatory": False},
        ],
    },
    "IFRS": [
        {"standard": "IFRS 9", "title": "Financial Instruments", "weight": 0.9},
        {"standard": "IFRS 15", "title": "Revenue from Contracts with Customers", "weight": 0.9},
        {"standard": "IFRS 16", "title": "Leases", "weight": 0.8},
    ]
}

PERMITTED_REASONS = ["not applicable", "confidential", "legal prohibition", "information unavailable"]

def extract_document_text(file_path: str, file_type: str) -> str:
    if file_type == "pdf":
        return extract_text(file_path)
    elif file_type == "docx":
        doc = Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])
    elif file_type in ["png", "jpg", "jpeg"]:
        return pytesseract.image_to_string(file_path)
    return ""

def detect_and_process_text(text: str) -> tuple[str, spacy.language.Language]:
    lang = detect(text[:500])
    if lang not in SPACY_MODELS:
        lang = "en"
    return lang, SPACY_MODELS[lang]

def translate_text(text: str, src_lang: str, dest_lang: str) -> str:
    if src_lang == dest_lang or not text:
        return text
    try:
        return translator.translate(text, src=src_lang, dest=dest_lang).text
    except Exception as e:
        print(f"Translation error: {e}")
        return text

def analyze_gri_compliance(text: str, compliance_type: str, user_omissions: Dict[str, str] = None, output_lang: str = "en") -> Dict[str, Any]:
    doc_lang, nlp = detect_and_process_text(text)
    doc = nlp(text.lower())
    standards = GRI_STANDARDS[compliance_type]
    report = []
    suggestions = []

    if compliance_type == "GRI":
        for standard, disclosures in standards.items():
            for disclosure in disclosures:
                disclosure_id = disclosure["disclosure"]
                disclosure_title = disclosure["title"]
                weight = disclosure["weight"]
                is_mandatory = disclosure.get("mandatory", False)
                sector_ref = disclosure.get("sector_ref", None)

                pattern = re.compile(rf"\b{disclosure_id}\b|\b{disclosure_title}\b", re.IGNORECASE)
                mentioned = pattern.search(text)

                score = 0
                remarks = ""
                omission = None

                user_omission_reason = user_omissions.get(f"{standard}_{disclosure_id}") if user_omissions else None

                if user_omission_reason:
                    if user_omission_reason in PERMITTED_REASONS and not is_mandatory:
                        omission = {"reason": user_omission_reason, "explanation": f"User specified '{user_omission_reason}' as the reason for omission."}
                        remarks = f"Disclosure omitted with reason: {user_omission_reason}."
                    else:
                        remarks = "Invalid or not permitted omission reason provided by user."
                        suggestions.append({
                            "standard": standard,
                            "suggestion": f"Provide a valid reason for omission for {disclosure_id} {disclosure_title} or include the disclosure."
                        })
                elif mentioned:
                    for sent in doc.sents:
                        if disclosure_id.lower() in sent.text or disclosure_title.lower() in sent.text:
                            if any(token.lemma_ in ["report", "include", "disclose", "provide"] for token in sent):
                                score = 90 * weight
                                remarks = "Disclosure addressed in the document."
                            else:
                                score = 50 * weight
                                remarks = "Disclosure mentioned but not fully addressed."
                            break
                    else:
                        score = 50 * weight
                        remarks = "Disclosure mentioned but not fully addressed."
                else:
                    score = 0
                    if is_mandatory:
                        remarks = "Mandatory disclosure missing."
                        suggestions.append({
                            "standard": standard,
                            "suggestion": f"Include {disclosure_id} {disclosure_title} as it is a mandatory disclosure."
                        })
                    else:
                        for reason in PERMITTED_REASONS:
                            if reason in text.lower():
                                omission = {"reason": reason, "explanation": f"Organization stated '{reason}' as the reason for omission."}
                                remarks = f"Disclosure omitted with reason: {reason}."
                                break
                        if not omission:
                            remarks = "Disclosure not found in the document."
                            suggestions.append({
                                "standard": standard,
                                "suggestion": f"Consider reporting on {disclosure_id} {disclosure_title} to improve compliance."
                            })

                remarks = translate_text(remarks, doc_lang, output_lang)
                if omission:
                    omission["reason"] = translate_text(omission["reason"], doc_lang, output_lang)
                    omission["explanation"] = translate_text(omission["explanation"], doc_lang, output_lang)
                if suggestions:
                    for suggestion in suggestions:
                        suggestion["suggestion"] = translate_text(suggestion["suggestion"], doc_lang, output_lang)

                report.append({
                    "Standard": standard,
                    "Requirement": f"{disclosure_id} {disclosure_title}",
                    "Compliance Score": round(score, 2),
                    "Remarks": remarks,
                    "Omission": omission,
                    "Sector Ref": sector_ref
                })
    else:
        for standard in standards:
            pattern = re.compile(rf"\b{standard['standard']}\b|\b{standard['title']}\b", re.IGNORECASE)
            score = 100 * standard["weight"] if pattern.search(text) else 0
            remarks = "Standard addressed in the document." if score > 0 else "Standard not found."
            remarks = translate_text(remarks, doc_lang, output_lang)
            report.append({
                "Standard": standard["standard"],
                "Requirement": standard["title"],
                "Compliance Score": round(score, 2),
                "Remarks": remarks,
                "Omission": None,
                "Sector Ref": None
            })

    return {"report": report, "suggestions": suggestions}

# User Registration/Login Models
class User(BaseModel):
    username: str
    email: str
    password: str

@app.post("/signup")
async def signup(user: User):
    try:
        user_cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            (user.username, user.email, user.password)
        )
        user_conn.commit()
        return {"message": "User registered successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/login")
async def login(user: User):
    user_cursor.execute(
        "SELECT * FROM users WHERE username = ? AND email = ? AND password = ?",
        (user.username, user.email, user.password)
    )
    db_user = user_cursor.fetchone()
    if db_user:
        return {"message": "Login successful", "username": user.username}
    raise HTTPException(status_code=401, detail="Invalid username, email, or password")

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), omissions: str = Form(None)):
    file_ext = file.filename.split(".")[-1].lower()
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    try:
        minio_client.fput_object(bucket_name, file.filename, file_path)
    except S3Error as e:
        raise HTTPException(status_code=500, detail="Failed to upload file to MinIO.")
    finally:
        os.remove(file_path)
    
    return {"doc_id": file.filename}

@app.get("/analyze/{doc_id}")
async def analyze_document(doc_id: str, compliance_type: str = "GRI", omissions: str = None, lang: str = "en", request: Request = None):
    try:
        file_path = f"temp_{doc_id}"
        minio_client.fget_object(bucket_name, doc_id, file_path)
        file_ext = doc_id.split(".")[-1].lower()
        text = extract_document_text(file_path, file_ext)
        os.remove(file_path)
        
        if await request.is_disconnected():
            return {"message": "Analysis cancelled"}

        user_omissions = json.loads(omissions) if omissions else {}
        result = analyze_gri_compliance(text, compliance_type.upper(), user_omissions, output_lang=lang)

        cursor.execute(
            "INSERT INTO reports (doc_id, compliance_type, report, suggestions, timestamp) VALUES (?, ?, ?, ?, ?)",
            (doc_id, compliance_type.upper(), json.dumps(result["report"]), json.dumps(result["suggestions"]), datetime.now().isoformat())
        )
        conn.commit()

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics")
async def get_analytics(compliance_type: str = "GRI", lang: str = "en"):
    cursor.execute("SELECT report, suggestions FROM reports WHERE compliance_type = ?", (compliance_type.upper(),))
    rows = cursor.fetchall()

    all_reports = []
    all_suggestions = []
    for row in rows:
        report = json.loads(row[0])
        suggestions = json.loads(row[1])
        all_reports.extend(report)
        all_suggestions.extend(suggestions)

    # Aggregate stats by unique standard
    stats: Dict[str, Any] = {}
    for row in all_reports:
        standard = row["Standard"]
        if standard not in stats:
            stats[standard] = {"totalScore": 0, "count": 0}
        stats[standard]["totalScore"] += row["Compliance Score"]
        stats[standard]["count"] += 1

    compliance_stats = [
        {
            "standard": standard,
            "avgScore": round(data["totalScore"] / data["count"], 2),
            "totalReports": data["count"]
        }
        for standard, data in stats.items()
    ]

    # Translate suggestions and report fields
    for suggestion in all_suggestions:
        suggestion["suggestion"] = translate_text(suggestion["suggestion"], "en", lang)
        suggestion["standard"] = translate_text(suggestion["standard"], "en", lang)

    return {"complianceStats": compliance_stats, "aiSuggestions": all_suggestions}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
