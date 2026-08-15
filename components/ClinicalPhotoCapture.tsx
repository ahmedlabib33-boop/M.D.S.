"use client";

import { useEffect, useRef, useState } from "react";

type Quality = {checks: Array<{label: string; status: "pass" | "review"; detail: string}>};
type Review = {status: "completed"; model: string; latencyMs: number; observations: string[]; limitations: string[]; safetyRoute: "emergency" | "urgent" | "routine" | "indeterminate"; recommendedAction: string; clinicalEnglish: string; plainEnglish: string; medicalArabic: string; plainArabic: string; questionsForClinician: string[]; disclaimer: string};
const MAX_BYTES = 6 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export default function ClinicalPhotoCapture({symptoms}: {symptoms: string}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [quality, setQuality] = useState<Quality | null>(null);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function inspectImage(next: File) {
    const bitmap = await createImageBitmap(next);
    const width = bitmap.width, height = bitmap.height;
    const scale = Math.min(1, 512 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    if (!ctx) throw new Error("This browser cannot inspect the selected image.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = new Float32Array(canvas.width * canvas.height); let sum = 0;
    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) { const y = .2126*pixels[i] + .7152*pixels[i+1] + .0722*pixels[i+2]; luminance[p] = y; sum += y; }
    const mean = sum / luminance.length; let variance = 0;
    for (const value of luminance) variance += (value - mean) ** 2;
    const contrast = Math.sqrt(variance / luminance.length); let edge = 0, samples = 0;
    for (let y = 1; y < canvas.height - 1; y += 1) for (let x = 1; x < canvas.width - 1; x += 1) { const i=y*canvas.width+x; edge += Math.abs(4*luminance[i]-luminance[i-1]-luminance[i+1]-luminance[i-canvas.width]-luminance[i+canvas.width]); samples += 1; }
    const edgeEnergy = samples ? edge / samples : 0;
    setQuality({checks:[
      {label:"Resolution",status:Math.min(width,height)>=720?"pass":"review",detail:width+" × "+height+" px"},
      {label:"Exposure",status:mean>=45&&mean<=215?"pass":"review",detail:mean<45?"Image is very dark":mean>215?"Image is very bright":"Usable brightness"},
      {label:"Contrast",status:contrast>=24?"pass":"review",detail:contrast>=24?"Visible tonal separation":"Low tonal separation"},
      {label:"Sharpness signal",status:edgeEnergy>=7?"pass":"review",detail:edgeEnergy>=7?"Edges appear detectable":"Possible blur or low detail"},
    ]});
  }

  async function choose(next: File | null) {
    setQuality(null); setReview(null); setConsent(false); setMessage("");
    if (!next) { setFile(null); return; }
    if (!ACCEPTED.includes(next.type)) { setFile(null); setMessage("Use JPEG, PNG, or WebP. On iPhone, take the photo here or export it as Most Compatible/JPEG."); return; }
    if (next.size > MAX_BYTES) { setFile(null); setMessage("The selected image exceeds the 6 MB limit."); return; }
    setFile(next);
    try { await inspectImage(next); } catch (error) { setMessage(error instanceof Error ? error.message : "Image inspection failed."); }
  }

  function toDataUrl(value: File) {
    return new Promise<string>((resolve, reject) => { const reader=new FileReader(); reader.onerror=()=>reject(new Error("The image could not be read.")); reader.onload=()=>resolve(String(reader.result)); reader.readAsDataURL(value); });
  }

  async function runReview() {
    if (!file || !consent) return;
    setState("loading"); setMessage(""); setReview(null);
    try {
      const imageDataUrl = await toDataUrl(file);
      const response = await fetch("/api/image-review", {method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({consentToExternalProcessing:true,image:{dataUrl:imageDataUrl,mimeType:file.type,fileName:file.name},symptomContext:symptoms.trim().slice(0,4000)})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clinical image review is unavailable.");
      setReview(data); setState("idle");
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "Clinical image review is unavailable."); }
  }

  function clear() { setFile(null); setQuality(null); setReview(null); setConsent(false); setMessage(""); setState("idle"); if(inputRef.current) inputRef.current.value=""; }

  return (
    <details className="formDetails imageReview">
      <summary>Clinical photo review <span>Optional · camera or photo library</span></summary>
      <p className="cautionText">Local quality checks run first. Model output describes visible features only and cannot establish or exclude a diagnosis. Do not upload intimate images, identity documents, or images containing names.</p>
      <label className="dropZone imageDrop">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event)=>void choose(event.target.files?.[0]??null)} />
        <span>{file ? file.name : "Take or select a clinical photo"}</span>
        <small>iOS Safari compatible · JPEG, PNG, WebP · maximum 6 MB</small>
      </label>
      {preview && <div className="imagePreview"><img src={preview} alt="Selected clinical image preview" /><button type="button" className="textButton dangerText" onClick={clear}>Remove image</button></div>}
      {quality && <div className="qualityGrid">{quality.checks.map((check)=><article className={check.status} key={check.label}><span>{check.label}</span><strong>{check.status}</strong><small>{check.detail}</small></article>)}</div>}
      {file && <label className="checkLine consentLine"><input type="checkbox" checked={consent} onChange={(event)=>setConsent(event.target.checked)} /><span>I consent to this image and the symptom text above being sent once to the configured external vision model. I understand the result is not a diagnosis and the application does not save the payload.</span></label>}
      {file && <button type="button" className="secondaryButton" disabled={!consent||state==="loading"} onClick={runReview}>{state==="loading"?"Reviewing visible features…":"Run clinical image review"}</button>}
      {message && <p className="errorText">{message}</p>}
      {review && <section className={"imageResult "+review.safetyRoute} aria-live="polite">
        <div className="panelHeader"><div><span className="sectionLabel">Visible-image review</span><h3>{review.safetyRoute} routing</h3></div><span className="sourceBadge">{review.model} · {review.latencyMs} ms</span></div>
        <p className="imageAction">{review.recommendedAction}</p>
        <div className="resultColumns"><div><h4>Observed in the image</h4><ul>{review.observations.map((item)=><li key={item}>{item}</li>)}</ul></div><div><h4>Limitations</h4><ul>{review.limitations.map((item)=><li key={item}>{item}</li>)}</ul></div></div>
        <details><summary>Four-register explanation</summary><p>{review.clinicalEnglish}</p><p>{review.plainEnglish}</p><p dir="rtl">{review.medicalArabic}</p><p dir="rtl">{review.plainArabic}</p></details>
        <p className="finalDisclaimer">{review.disclaimer}</p>
      </section>}
    </details>
  );
}
