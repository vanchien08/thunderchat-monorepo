WITH bounds AS (
   SELECT MIN(sticker_id) AS min_id, MAX(sticker_id) AS max_id FROM greeting_stickers
),
random_id AS (
   SELECT FLOOR(random() * (max_id - min_id + 1)) + min_id AS rand_id FROM bounds
)
SELECT 
   s.id,
   s.sticker_name AS "stickerName",
   s.image_url AS "imageUrl", 
   s.category_id AS "categoryId",
   s.created_at AS "createdAt"
FROM stickers s
WHERE s.id = (SELECT rand_id FROM random_id)
LIMIT 1;