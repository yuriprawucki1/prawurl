PRAGMA foreign_keys = ON;

UPDATE links
SET destination_domain = lower(rtrim(
  CASE
    WHEN instr(substr(destination_url, instr(destination_url, '://') + 3), '/') = 0
      THEN substr(destination_url, instr(destination_url, '://') + 3)
    ELSE substr(
      substr(destination_url, instr(destination_url, '://') + 3),
      1,
      instr(substr(destination_url, instr(destination_url, '://') + 3), '/') - 1
    )
  END,
  '.'
))
WHERE destination_domain = '';
