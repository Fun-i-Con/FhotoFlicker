// Supabase の画像変換は有料プランの機能なので、アップロード前にブラウザで縮小する。
// 再エンコードで EXIF（位置情報を含む）も落ちる。
export async function resizeToJpeg(file: Blob, maxEdge = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('画像の変換に失敗しました。')
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました。'))),
      'image/jpeg',
      quality
    )
  })
}
