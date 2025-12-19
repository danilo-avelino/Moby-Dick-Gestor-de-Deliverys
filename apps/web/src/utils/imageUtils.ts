/**
 * Compresses an image file to ensure it's under a certain size limit (default 1MB).
 * Returns a Promise that resolves to the base64 string of the compressed image.
 */
export const compressImage = async (file: File, maxSizeMB: number = 1): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimensions to avoid huge canvas memory usage
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Start with high quality and reduce if needed
                let quality = 0.9;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);

                // Simple loop to reduce quality until size is met
                // Note: Base64 size is approx 1.37 * binary size
                const maxBytes = maxSizeMB * 1024 * 1024;

                while (dataUrl.length > maxBytes * 1.37 && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
