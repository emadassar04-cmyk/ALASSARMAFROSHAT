// صورة لكل قسم حسب اسمه. صورة القسم المرفوعة من الإدارة (image_url) لها الأولوية دائماً.
// الصور التوضيحية من Unsplash (انظر IMAGES_CREDITS.md) وتمثّل نوع المنتجات لا منتجات بعينها.
const MAP: [RegExp, string][] = [
  [/سجاد|موكيت/, "/images/categories/rugs.webp"],
  [/ستائر|ستارة|برادي/, "/images/categories/curtains.webp"],
  [/مخد|وساد/, "/images/categories/pillows.webp"],
  [/بطاني|لحف|لحاف/, "/images/categories/blankets.webp"],
  [/شراشف|شرشف|ملاي/, "/images/categories/sheets.webp"],
  [/مرات|مرتب|فرشات|إسفنج|اسفنج/, "/images/categories/mattresses.webp"],
  [/منزلي|متنوع|إكسسوار|اكسسوار|كنب|فرش/, "/images/categories/home-textiles.webp"],
];

export function categoryImage(name: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  return MAP.find(([re]) => re.test(name))?.[1] ?? "/images/categories/home-textiles.webp";
}
