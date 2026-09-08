UPDATE products
SET image_url = 'images/PressOn Nails_Pink.JPG',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{image}',
      to_jsonb('images/PressOn Nails_Pink.JPG'::text),
      true
    ),
    updated_at = now()
WHERE legacy_id = '2'
  AND title = 'Pink Explosion';
