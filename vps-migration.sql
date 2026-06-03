-- JobOrbit VPS Migration — Employer Portal Phase 2
-- Run with: mysql -u jobuser -p hirehub -f < vps-migration.sql
-- The -f flag ignores "already exists" errors safely

CREATE TABLE IF NOT EXISTS shared_views (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employer_id INT NOT NULL,
  token       VARCHAR(64) NOT NULL UNIQUE,
  data_type   ENUM('jobs','applications','candidates') NOT NULL,
  privacy     ENUM('public','private') NOT NULL DEFAULT 'public',
  filters     JSON,
  title       VARCHAR(255),
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME DEFAULT NOW(),
  INDEX idx_token (token),
  INDEX idx_employer (employer_id)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS share_requests (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  share_token      VARCHAR(64) NOT NULL,
  requester_email  VARCHAR(255) NOT NULL,
  requester_name   VARCHAR(255),
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  access_token     VARCHAR(64),
  created_at       DATETIME DEFAULT NOW(),
  INDEX idx_share_token (share_token)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employer_feedback (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  employer_id  INT NOT NULL,
  company_name VARCHAR(255),
  rating       TINYINT NOT NULL,
  category     ENUM('bug','feature','general','other') NOT NULL,
  message      TEXT NOT NULL,
  page_url     VARCHAR(500),
  status       ENUM('new','read','resolved') DEFAULT 'new',
  created_at   DATETIME DEFAULT NOW(),
  INDEX idx_employer (employer_id),
  INDEX idx_status   (status)
) DEFAULT CHARSET=utf8mb4;

ALTER TABLE job_applications ADD COLUMN screening_answers  JSON         NULL;
ALTER TABLE job_applications ADD COLUMN iqama_number       VARCHAR(20)  NULL;
ALTER TABLE job_screening    ADD COLUMN require_iqama_number TINYINT(1) DEFAULT 0;

INSERT IGNORE INTO admin_menu (key_name, label, icon, href, order_num, is_active)
SELECT 'feedback','Feedback','bi-chat-heart','feedback.html',
       COALESCE(MAX(order_num),0)+1, 1
FROM admin_menu;
