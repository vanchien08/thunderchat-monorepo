-- @param {DateTime} $1:msgTime
-- @param {Int} $2:limit

SELECT
    id,
    author_id AS "authorId",
    content AS "content",
    created_at AS "createdAt",
    direct_chat_id AS "directChatId"
FROM messages
WHERE
    created_at < $1
ORDER BY created_at DESC
LIMIT $2;