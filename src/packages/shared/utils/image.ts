import { supabase } from '../supabase';

/**
 * Compresses an image file client-side into a light JPEG Data URL,
 * and optionally uploads it to Supabase Storage if configured.
 */
export const processProfileImage = async (file: File): Promise<string> => {
  // First, compress image using HTML5 Canvas for fast rendering
  const base64Url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 250;
        const maxHeight = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  // If Supabase storage client is available, attempt bucket upload
  if (supabase) {
    try {
      const fileName = `avatars/avatar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
      const { data, error } = await supabase.storage
        .from('profiles')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage.from('profiles').getPublicUrl(fileName);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (sErr) {
      console.warn("Supabase storage upload note:", sErr);
    }
  }

  return base64Url;
};
