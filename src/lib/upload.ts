export async function uploadFiles(files: File[]) {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = 'Erro ao enviar arquivo.';
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      console.error('Erro ao processar resposta de erro do upload:', text);
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data.files;
  } catch (e) {
    console.error('Resposta do servidor não é um JSON válido:', text);
    throw new Error('Resposta inválida do servidor ao enviar arquivo.');
  }
}
