// STT SIMULADO: ignora o áudio e devolve um texto fixo (IRIS_MOCK_STT_TEXT). Só para testes.
export async function transcribe({ audio }) { return { text: process.env.IRIS_MOCK_STT_TEXT || 'quantos dias faltam', bytes: audio.length }; }
