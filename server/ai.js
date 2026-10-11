export function aiReady() { return Boolean(process.env.GEMINI_API_KEY); }
export async function generateJson(prompt,images=[]) {
  if(!aiReady()) throw new Error('AI 계정이 아직 연결되지 않았어요. 서버에 Gemini 키를 연결하면 사용할 수 있어요.');
  const parts=[{text:prompt},...images.map(data=>({inlineData:{mimeType:'image/webp',data}}))];
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',temperature:0.3}}),signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error(response.status===429?'AI 무료 사용 한도에 도달했어요. 잠시 뒤 다시 시도하세요.':'AI 요청에 실패했어요. 계정과 모델 설정을 확인해 주세요.');
  const result=await response.json(); const raw=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('');
  if(!raw) throw new Error('AI가 분석 결과를 반환하지 않았어요.');
  return JSON.parse(raw);
}
