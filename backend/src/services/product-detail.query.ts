import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type ProductDetailRow = Prisma.productsGetPayload<{
  include: {
    categories: true;
    product_images: true;
    product_variants: true;
    product_options: { include: { product_option_values: true } };
    product_collections: { include: { collections: true } };
  };
}>;

export async function loadProductDetail(identifier: string): Promise<ProductDetailRow | null> {
  // Aggregate relations in PostgreSQL to avoid a remote round trip per relation.
  // Reviews are not used by formatDbProduct; its summary comes from the product row.
  const rows = await prisma.$queryRaw<ProductDetailRow[]>`
    SELECT p.*, to_jsonb(c) AS categories,
      COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i."sortOrder")
        FROM product_images i WHERE i."productId" = p.id), '[]'::jsonb) AS product_images,
      COALESCE((SELECT jsonb_agg(to_jsonb(v))
        FROM product_variants v WHERE v."productId" = p.id), '[]'::jsonb) AS product_variants,
      COALESCE((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object(
          'product_option_values', COALESCE((
            SELECT jsonb_agg(to_jsonb(ov) ORDER BY ov."sortOrder")
            FROM product_option_values ov WHERE ov."optionId" = o.id
          ), '[]'::jsonb)))
        FROM product_options o WHERE o."productId" = p.id), '[]'::jsonb) AS product_options,
      COALESCE((SELECT jsonb_agg(to_jsonb(pc) || jsonb_build_object(
          'collections', jsonb_build_object('id', col.id, 'name', col.name, 'slug', col.slug)) ORDER BY pc."collectionId")
        FROM (SELECT * FROM product_collections WHERE "productId" = p.id ORDER BY "collectionId" LIMIT 5) pc
        JOIN collections col ON col.id = pc."collectionId"), '[]'::jsonb) AS product_collections
    FROM products p
    LEFT JOIN categories c ON c.id = p."categoryId"
    WHERE p.id = ${identifier} OR p.slug = ${identifier}
    LIMIT 1
  `;
  return rows[0] || null;
}
