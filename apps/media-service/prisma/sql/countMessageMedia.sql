-- @param {Int} $1:directChatId direct chat ID that query based on to count media messages

SELECT 
  CASE 
    WHEN m.type = 'TEXT' THEN 'TEXT'
    WHEN m.type = 'MEDIA' AND mm.type = 'IMAGE' THEN 'IMAGE'
    WHEN m.type = 'MEDIA' AND mm.type = 'VIDEO' THEN 'VIDEO'
    WHEN m.type = 'MEDIA' AND mm.type = 'AUDIO' THEN 'AUDIO'
    WHEN m.type = 'MEDIA' AND mm.type = 'DOCUMENT' THEN 'DOCUMENT'
  END AS message_type,
  COUNT(*) AS total
FROM messages m
LEFT JOIN message_medias mm ON m.media_id = mm.id
WHERE m.is_deleted = FALSE
  AND (
    m.type = 'TEXT' OR 
    (m.type = 'MEDIA' AND mm.type IN ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'))
  )
  AND m.direct_chat_id = $1
GROUP BY message_type
ORDER BY message_type;
