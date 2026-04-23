// src/utils/inventoryUpload.ts

export async function uploadInventoryImageViaFormData(args: {
  endpoint: string;
  adminKey: string;
  itemId: string | number;
  file: File;
}) {
  const form = new FormData();
  form.append("mode", "inventoryUploadImage");
  form.append("adminKey", args.adminKey);
  form.append("ID", String(args.itemId));
  form.append("image", args.file); // expects backend to read multipart/form-data

  const res = await fetch(args.endpoint, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return res.json();
}
