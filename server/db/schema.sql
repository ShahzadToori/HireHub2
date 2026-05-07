-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 27, 2026 at 09:18 PM
-- Server version: 10.4.24-MariaDB
-- PHP Version: 8.1.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hirehub_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `username` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `username`, `email`, `password`, `created_at`) VALUES
(1, 'admin', 'shahzadali33389@gmail.com', '$2b$12$vN7yJe6qCVFj4D3wIUZ2CualyLv.jyXiCNapORe4gBPQ55fNGE/qe', '2026-02-24 08:20:00');

-- --------------------------------------------------------

--
-- Table structure for table `ad_placements`
--

CREATE TABLE `ad_placements` (
  `id` int(11) NOT NULL,
  `zone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ad_code` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ad_placements`
--

INSERT INTO `ad_placements` (`id`, `zone`, `ad_code`, `enabled`, `updated_at`) VALUES
(1, 'top', '<!-- AdSense top banner code here -->', 1, '2026-02-24 08:11:41'),
(2, 'sidebar', '<!-- AdSense sidebar code here -->', 1, '2026-02-24 08:11:41'),
(3, 'between_jobs', '<!-- AdSense in-feed code here -->', 1, '2026-02-24 08:11:41'),
(4, 'footer', '<!-- AdSense footer code here -->', 0, '2026-02-24 08:11:41');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(110) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `slug`) VALUES
(1, 'Technology', 'technology'),
(2, 'Marketing', 'marketing'),
(3, 'Finance', 'finance'),
(4, 'Design', 'design'),
(5, 'Sales', 'sales'),
(6, 'HR', 'hr'),
(7, 'Operations', 'operations'),
(8, 'Healthcare', 'healthcare'),
(9, 'Education', 'education'),
(10, 'Other', 'other');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` int(11) NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int(11) NOT NULL,
  `location` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Full-time',
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `map_link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extra_fields` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `featured` tinyint(1) NOT NULL DEFAULT 0,
  `featured_until` date DEFAULT NULL,
  `sponsored` tinyint(1) NOT NULL DEFAULT 0,
  `views` int(11) NOT NULL DEFAULT 0,
  `slug` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `jobs`
--

INSERT INTO `jobs` (`id`, `title`, `company`, `category_id`, `location`, `job_type`, `description`, `phone`, `whatsapp`, `email`, `map_link`, `extra_fields`, `status`, `featured`, `featured_until`, `sponsored`, `views`, `slug`, `created_at`, `updated_at`) VALUES
(1, 'Senior React Developer', 'TechNova Solutions', 1, 'New York, NY', 'Full-time', 'We are looking for an experienced React Developer to join our growing engineering team. You will be responsible for building and maintaining high-performance web applications.\n\nResponsibilities:\n- Build reusable components and front-end libraries\n- Optimize components for maximum performance\n- Collaborate with backend developers and designers\n- Write clean, maintainable code\n\nRequirements:\n- 4+ years of React experience\n- Strong knowledge of JavaScript ES6+\n- Experience with Redux or similar state management\n- Familiarity with REST APIs and Git\n\nBenefits:\n- Competitive salary $90,000 - $120,000\n- Remote work options\n- Health insurance\n- 20 days paid leave', '+12125550101', '12125550101', 'careers@technova.com', NULL, NULL, 'expired', 1, NULL, 1, 245, 'senior-react-developer', '2026-02-24 09:03:16', '2026-02-24 09:08:01'),
(2, 'Full Stack Node.js Developer', 'CloudBase Inc', 1, 'San Francisco, CA', 'Full-time', 'CloudBase is hiring a Full Stack Developer with strong Node.js and React skills to help build our next-generation cloud platform.\n\nResponsibilities:\n- Develop RESTful APIs using Node.js and Express\n- Build responsive frontends with React\n- Manage databases (MySQL, MongoDB)\n- Deploy applications on AWS\n\nRequirements:\n- 3+ years full stack experience\n- Proficiency in Node.js, Express, React\n- Experience with cloud platforms (AWS/GCP)\n- Knowledge of CI/CD pipelines\n\nBenefits:\n- Salary $85,000 - $110,000\n- Stock options\n- Flexible hours\n- Remote friendly', '+14155550102', '14155550102', 'jobs@cloudbase.io', NULL, NULL, 'active', 1, '2025-05-31', 0, 189, 'fullstack-nodejs-developer-cloudbase', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(3, 'Python Backend Engineer', 'DataSphere AI', 1, 'Austin, TX', 'Full-time', 'DataSphere AI is seeking a talented Python Backend Engineer to develop scalable APIs and data pipelines for our AI-powered analytics platform.\n\nResponsibilities:\n- Design and build Python-based microservices\n- Develop data processing pipelines\n- Work with machine learning engineers\n- Ensure high availability and performance\n\nRequirements:\n- 3+ years Python development experience\n- Experience with Django or FastAPI\n- Knowledge of PostgreSQL and Redis\n- Familiarity with Docker and Kubernetes\n\nSalary: $95,000 - $130,000\nLocation: Austin TX (Hybrid)', '+15125550103', '15125550103', 'hiring@datasphere.ai', NULL, NULL, 'active', 0, NULL, 0, 134, 'python-backend-engineer-datasphere', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(4, 'DevOps Engineer', 'Nexus Systems', 1, 'Remote', 'Remote', 'We are looking for a DevOps Engineer to manage our cloud infrastructure and implement CI/CD pipelines for our SaaS products.\n\nResponsibilities:\n- Manage AWS infrastructure using Terraform\n- Build and maintain CI/CD pipelines\n- Monitor system performance and uptime\n- Implement security best practices\n\nRequirements:\n- 3+ years DevOps experience\n- Strong knowledge of AWS services\n- Experience with Docker, Kubernetes\n- Scripting skills (Bash, Python)\n\nSalary: $100,000 - $140,000\n100% Remote position', '+18005550104', '18005550104', 'devops@nexussystems.com', NULL, NULL, 'active', 0, NULL, 0, 98, 'devops-engineer-nexus-systems', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(5, 'Mobile App Developer (Flutter)', 'AppCraft Studio', 1, 'Chicago, IL', 'Full-time', 'AppCraft Studio is hiring a Flutter Developer to build beautiful cross-platform mobile applications for iOS and Android.\n\nResponsibilities:\n- Develop Flutter applications for iOS and Android\n- Integrate REST APIs and Firebase\n- Write unit and widget tests\n- Collaborate with UI/UX designers\n\nRequirements:\n- 2+ years Flutter/Dart experience\n- Published apps on App Store or Play Store\n- Knowledge of state management (Bloc, Provider)\n- Experience with Firebase\n\nSalary: $75,000 - $100,000', '+13125550105', '13125550105', 'flutter@appcraft.studio', NULL, NULL, 'active', 0, NULL, 0, 76, 'flutter-mobile-developer-appcraft', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(6, 'Digital Marketing Manager', 'GrowthLab Agency', 2, 'Los Angeles, CA', 'Full-time', 'GrowthLab is looking for a results-driven Digital Marketing Manager to lead our clients marketing campaigns across multiple channels.\n\nResponsibilities:\n- Plan and execute digital marketing campaigns\n- Manage SEO/SEM, social media, and email marketing\n- Analyze performance metrics and optimize ROI\n- Manage a team of 3 marketing specialists\n\nRequirements:\n- 4+ years digital marketing experience\n- Google Ads and Meta Ads certified\n- Strong analytical skills\n- Experience with HubSpot or similar CRM\n\nSalary: $70,000 - $90,000', '+13105550201', '13105550201', 'marketing@growthlab.agency', NULL, NULL, 'active', 1, '2025-05-15', 0, 167, 'digital-marketing-manager-growthlab', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(7, 'SEO Specialist', 'RankBoost Digital', 2, 'Remote', 'Remote', 'RankBoost Digital is hiring a skilled SEO Specialist to help our clients achieve top Google rankings and drive organic traffic.\n\nResponsibilities:\n- Conduct keyword research and competitor analysis\n- Optimize on-page and off-page SEO\n- Build high-quality backlinks\n- Produce monthly SEO performance reports\n\nRequirements:\n- 2+ years SEO experience\n- Proficiency with Ahrefs, SEMrush, or Moz\n- Knowledge of Google Search Console\n- Basic HTML knowledge\n\nSalary: $55,000 - $75,000\nFully remote position', '+18005550202', '18005550202', 'seo@rankboost.digital', NULL, NULL, 'active', 0, NULL, 0, 112, 'seo-specialist-rankboost-digital', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(8, 'Content Marketing Writer', 'BrandVoice Media', 2, 'New York, NY', 'Part-time', 'BrandVoice Media is seeking a creative Content Writer to produce engaging blog posts, social media content, and email newsletters for our B2B clients.\n\nResponsibilities:\n- Write SEO-optimized blog posts and articles\n- Create social media content calendars\n- Draft email marketing campaigns\n- Research industry topics and trends\n\nRequirements:\n- 2+ years content writing experience\n- Excellent English writing skills\n- Understanding of SEO principles\n- Experience with WordPress\n\nPay: $25 - $40 per hour\nPart-time: 20 hours/week', '+12125550203', '12125550203', 'content@brandvoice.media', NULL, NULL, 'active', 0, NULL, 0, 88, 'content-marketing-writer-brandvoice', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(9, 'Financial Analyst', 'Capital Insight Group', 3, 'New York, NY', 'Full-time', 'Capital Insight Group is seeking a Financial Analyst to support investment decisions and prepare financial models for our portfolio companies.\n\nResponsibilities:\n- Build financial models and valuations\n- Analyze financial statements and KPIs\n- Prepare investment memos and reports\n- Support due diligence processes\n\nRequirements:\n- Bachelor degree in Finance or Accounting\n- 2+ years financial analysis experience\n- Advanced Excel and PowerPoint skills\n- CFA Level 1 preferred\n\nSalary: $80,000 - $100,000\nBonus eligible', '+12125550301', '12125550301', 'finance@capitalinsight.com', NULL, NULL, 'active', 1, '2025-06-30', 0, 203, 'financial-analyst-capital-insight', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(10, 'Accountant', 'Precision Books LLC', 3, 'Houston, TX', 'Full-time', 'Precision Books is hiring a certified Accountant to manage bookkeeping, tax preparation, and financial reporting for our SMB clients.\n\nResponsibilities:\n- Manage accounts payable and receivable\n- Prepare monthly financial statements\n- Handle tax filings and compliance\n- Reconcile bank statements\n\nRequirements:\n- CPA certification or in progress\n- 3+ years accounting experience\n- Proficiency in QuickBooks\n- Strong attention to detail\n\nSalary: $60,000 - $80,000', '+17135550302', '17135550302', 'jobs@precisionbooks.com', NULL, NULL, 'active', 0, NULL, 0, 145, 'accountant-precision-books', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(11, 'UI/UX Designer', 'PixelCraft Design', 4, 'San Francisco, CA', 'Full-time', 'PixelCraft Design is looking for a talented UI/UX Designer to create beautiful and intuitive user experiences for web and mobile applications.\n\nResponsibilities:\n- Create wireframes, prototypes, and high-fidelity designs\n- Conduct user research and usability testing\n- Collaborate with developers to implement designs\n- Maintain and evolve our design system\n\nRequirements:\n- 3+ years UI/UX design experience\n- Proficiency in Figma\n- Strong portfolio of web and mobile projects\n- Understanding of accessibility standards\n\nSalary: $85,000 - $110,000', '+14155550401', '14155550401', 'design@pixelcraft.co', NULL, NULL, 'expired', 0, NULL, 0, 312, 'uiux-designer', '2026-02-24 09:03:16', '2026-02-24 09:07:25'),
(12, 'Graphic Designer', 'Creative Pulse Studio', 4, 'Miami, FL', 'Full-time', 'Creative Pulse Studio is hiring a Graphic Designer to create stunning visual content for branding, print, and digital media projects.\n\nResponsibilities:\n- Design logos, branding materials, and marketing collateral\n- Create social media graphics and digital ads\n- Work on packaging and print design\n- Maintain brand consistency across all materials\n\nRequirements:\n- 2+ years graphic design experience\n- Proficiency in Adobe Illustrator, Photoshop, InDesign\n- Strong portfolio\n- Attention to detail\n\nSalary: $55,000 - $70,000', '+13055550402', '13055550402', 'creative@creativepulse.studio', NULL, NULL, 'active', 0, NULL, 0, 97, 'graphic-designer-creative-pulse', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(13, 'Sales Manager', 'ProSell Corporation', 5, 'Dallas, TX', 'Full-time', 'ProSell Corporation is seeking an experienced Sales Manager to lead our B2B sales team and drive revenue growth for our SaaS product.\n\nResponsibilities:\n- Lead and mentor a team of 8 sales representatives\n- Set and track sales targets and KPIs\n- Develop sales strategies and processes\n- Build relationships with enterprise clients\n\nRequirements:\n- 5+ years B2B sales experience\n- Proven track record of meeting sales targets\n- Experience with Salesforce CRM\n- Excellent communication skills\n\nSalary: $90,000 - $120,000 + Commission', '+12145550501', '12145550501', 'sales@prosellcorp.com', NULL, NULL, 'active', 0, NULL, 0, 178, 'sales-manager-prosell-corporation', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(14, 'Business Development Executive', 'Venture Partners Ltd', 5, 'Chicago, IL', 'Full-time', 'Venture Partners is looking for a driven Business Development Executive to identify new business opportunities and expand our client base.\n\nResponsibilities:\n- Identify and qualify new business leads\n- Conduct product demonstrations and presentations\n- Negotiate contracts and close deals\n- Maintain client relationships\n\nRequirements:\n- 3+ years business development experience\n- Strong negotiation and presentation skills\n- Experience in SaaS or tech industry preferred\n- Self-motivated and target-driven\n\nSalary: $70,000 - $95,000 + OTE', '+13125550502', '13125550502', 'biz@venturepartners.com', NULL, NULL, 'active', 0, NULL, 0, 134, 'business-development-executive-venture', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(15, 'HR Manager', 'PeopleFirst HR Solutions', 6, 'Atlanta, GA', 'Full-time', 'PeopleFirst HR Solutions is hiring an experienced HR Manager to oversee all human resources functions for our 200-person organization.\n\nResponsibilities:\n- Manage full-cycle recruitment and onboarding\n- Develop HR policies and procedures\n- Handle employee relations and conflict resolution\n- Oversee payroll and benefits administration\n\nRequirements:\n- 5+ years HR management experience\n- SHRM-CP or PHR certification preferred\n- Knowledge of employment law and compliance\n- Strong interpersonal and communication skills\n\nSalary: $75,000 - $95,000', '+14045550601', '14045550601', 'hr@peoplefirst.solutions', NULL, NULL, 'active', 0, NULL, 0, 119, 'hr-manager-peoplefirst-solutions', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(16, 'Talent Acquisition Specialist', 'HireRight Staffing', 6, 'Remote', 'Remote', 'HireRight Staffing is seeking a Talent Acquisition Specialist to manage end-to-end recruitment for our tech and finance clients.\n\nResponsibilities:\n- Source candidates through LinkedIn, job boards, and networking\n- Screen resumes and conduct initial interviews\n- Coordinate interview processes with hiring managers\n- Manage candidate pipeline in ATS\n\nRequirements:\n- 2+ years recruitment experience\n- Experience recruiting for tech roles preferred\n- Proficiency with LinkedIn Recruiter\n- Strong organizational skills\n\nSalary: $55,000 - $75,000\nFully Remote', '+18005550602', '18005550602', 'recruit@hireright.staffing', NULL, NULL, 'active', 0, NULL, 0, 87, 'talent-acquisition-specialist-hireright', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(17, 'Registered Nurse', 'Metro General Hospital', 8, 'Boston, MA', 'Full-time', 'Metro General Hospital is hiring Registered Nurses for our ICU and Emergency departments. Join our dedicated team of healthcare professionals.\n\nResponsibilities:\n- Provide direct patient care in ICU/ER settings\n- Administer medications and treatments\n- Monitor and document patient conditions\n- Collaborate with physicians and medical staff\n\nRequirements:\n- Valid RN license in Massachusetts\n- BSN degree preferred\n- 2+ years acute care nursing experience\n- BLS and ACLS certification\n\nSalary: $75,000 - $95,000\nSign-on bonus available', '+16175550801', '16175550801', 'nursing@metrogeneral.org', NULL, NULL, 'active', 1, '2025-06-30', 0, 256, 'registered-nurse-metro-general-hospital', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(18, 'Medical Billing Specialist', 'HealthCare Admin Services', 8, 'Phoenix, AZ', 'Full-time', 'HealthCare Admin Services is looking for a Medical Billing Specialist to manage insurance claims and patient billing for our network of clinics.\n\nResponsibilities:\n- Process and submit insurance claims\n- Follow up on denied or unpaid claims\n- Post payments and manage billing records\n- Communicate with patients about billing\n\nRequirements:\n- 2+ years medical billing experience\n- Knowledge of ICD-10 and CPT codes\n- Experience with medical billing software\n- CPC or CCS certification preferred\n\nSalary: $45,000 - $60,000', '+16025550802', '16025550802', 'billing@hcadmin.services', NULL, NULL, 'active', 0, NULL, 0, 103, 'medical-billing-specialist-healthcare-admin', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(19, 'Online English Teacher', 'EduConnect Platform', 9, 'Remote', 'Part-time', 'EduConnect Platform is hiring Online English Teachers to teach students from around the world via our live video platform.\n\nResponsibilities:\n- Teach one-on-one English lessons online\n- Prepare lesson materials and assessments\n- Provide feedback and progress reports\n- Maintain a professional virtual classroom\n\nRequirements:\n- Native or near-native English speaker\n- TEFL/TESOL certification preferred\n- Stable internet connection and quiet space\n- Patient and enthusiastic personality\n\nPay: $15 - $25 per hour\nFlexible schedule - work from anywhere', '+18005550901', '18005550901', 'teachers@educonnect.platform', NULL, NULL, 'active', 0, NULL, 0, 142, 'online-english-teacher-educonnect', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(20, 'Curriculum Developer', 'LearnSmart Education', 9, 'Seattle, WA', 'Full-time', 'LearnSmart Education is seeking a Curriculum Developer to design engaging learning materials for our K-12 online education platform.\n\nResponsibilities:\n- Develop curriculum for Math, Science, and English subjects\n- Create lesson plans, assessments, and multimedia content\n- Align content with Common Core standards\n- Collaborate with subject matter experts\n\nRequirements:\n- Bachelor degree in Education or related field\n- 3+ years curriculum development experience\n- Strong writing and communication skills\n- Experience with e-learning tools (Articulate, Canvas)\n\nSalary: $65,000 - $85,000', '+12065550902', '12065550902', 'curriculum@learnsmart.edu', NULL, NULL, 'active', 0, NULL, 0, 91, 'curriculum-developer-learnsmart', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(21, 'Operations Manager', 'LogiFlow Warehousing', 7, 'Denver, CO', 'Full-time', 'LogiFlow Warehousing is looking for an Operations Manager to oversee daily warehouse operations and manage a team of 50+ staff.\n\nResponsibilities:\n- Oversee receiving, storage, and dispatch operations\n- Manage and train warehouse staff\n- Optimize workflows and reduce costs\n- Ensure compliance with safety regulations\n\nRequirements:\n- 5+ years operations/warehouse management\n- Experience with WMS software\n- Strong leadership and problem-solving skills\n- Knowledge of OSHA safety standards\n\nSalary: $80,000 - $100,000', '+13035551001', '13035551001', 'ops@logiflow.com', NULL, NULL, 'active', 0, NULL, 0, 123, 'operations-manager-logiflow', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(22, 'Customer Support Specialist', 'SupportHub Solutions', 7, 'Remote', 'Full-time', 'SupportHub Solutions is hiring Customer Support Specialists to provide exceptional service to our global customer base via chat, email, and phone.\n\nResponsibilities:\n- Respond to customer inquiries via chat, email, and phone\n- Resolve product issues and escalate when needed\n- Document interactions in CRM system\n- Achieve customer satisfaction targets\n\nRequirements:\n- 1+ years customer support experience\n- Excellent communication skills\n- Patience and problem-solving ability\n- Experience with Zendesk or similar helpdesk tools\n\nSalary: $40,000 - $55,000\nFully Remote', '+18005551002', '18005551002', 'support@supporthub.solutions', NULL, NULL, 'active', 0, NULL, 0, 167, 'customer-support-specialist-supporthub', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(23, 'WordPress Developer', 'WebWorks Agency', 1, 'Remote', 'Freelance', 'WebWorks Agency needs a skilled WordPress Developer for ongoing freelance projects including custom theme development and plugin customization.\n\nResponsibilities:\n- Build custom WordPress themes from scratch\n- Develop and customize plugins\n- Optimize site performance and SEO\n- Provide maintenance and support\n\nRequirements:\n- 3+ years WordPress development\n- Strong PHP, HTML, CSS, JavaScript skills\n- Experience with WooCommerce\n- Reliable and able to meet deadlines\n\nRate: $35 - $60 per hour\nOngoing freelance contract', '+18005551101', '18005551101', 'freelance@webworks.agency', NULL, NULL, 'active', 0, NULL, 0, 198, 'wordpress-developer-webworks-agency', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(24, 'Data Entry Specialist', 'Dataform Solutions', 7, 'Remote', 'Part-time', 'Dataform Solutions is hiring Data Entry Specialists for a long-term remote contract. Ideal for someone looking for flexible part-time work.\n\nResponsibilities:\n- Enter data accurately into company databases\n- Verify and clean existing data records\n- Generate basic reports from data\n- Follow data management procedures\n\nRequirements:\n- Fast and accurate typing (50+ WPM)\n- Proficiency in Microsoft Excel\n- Strong attention to detail\n- Reliable internet connection\n\nPay: $15 - $20 per hour\n20 hours per week', '+18005551102', '18005551102', 'data@dataform.solutions', NULL, NULL, 'active', 0, NULL, 0, 211, 'data-entry-specialist-dataform', '2026-02-24 09:03:16', '2026-02-24 09:03:16'),
(25, 'Full Stack Node.js Developer', 'CloudBase Inc', 4, 'San Francisco, CA', 'Contract', 'CloudBase is hiring a Full Stack Developer with strong Node.js and React skills to help build our next-generation cloud platform.\n\nResponsibilities:\n- Develop RESTful APIs using Node.js and Express\n- Build responsive frontends with React\n- Manage databases (MySQL, MongoDB)\n- Deploy applications on AWS\n\nRequirements:\n- 3+ years full stack experience\n- Proficiency in Node.js, Express, React\n- Experience with cloud platforms (AWS/GCP)\n- Knowledge of CI/CD pipelines\n\nBenefits:\n- Salary $85,000 - $110,000\n- Stock options\n- Flexible hours\n- Remote friendly', '+14155550401', '14155550401', 'design@pixelcraft.co', 'https://maps.app.goo.gl/xPcFC5EqjhHhGGRF7', NULL, 'active', 1, NULL, 0, 2, 'full-stack-nodejs-developer', '2026-02-25 23:41:22', '2026-02-27 16:28:46'),
(26, 'generation cloud platform.', 'CloudBase Inc', 4, 'San Francisco, CA', 'Full-time', 'CloudBase is hiring a Full Stack Developer with strong Node.js and React skills to help build our next-generation cloud platform.\n\nResponsibilities:\n- Develop RESTful APIs using Node.js and Express\n- Build responsive frontends with React\n- Manage databases (MySQL, MongoDB)\n- Deploy applications on AWS\n\nRequirements:\n- 3+ years full stack experience\n- Proficiency in Node.js, Express, React\n- Experience with cloud platforms (AWS/GCP)\n- Knowledge of CI/CD pipelines\n\nBenefits:\n- Salary $85,000 - $110,000\n- Stock options\n- Flexible hours\n- Remote friendly', '+14155550401', '14155550401', 'design@pixelcraft.co', 'https://maps.app.goo.gl/xPcFC5EqjhHhGGRF7', '{\"fld_1772189088001_min\":\"20\",\"fld_1772189088001_max\":\"25\"}', 'active', 0, NULL, 0, 0, 'generation-cloud-platform', '2026-02-27 10:46:48', '2026-02-27 10:46:48'),
(27, 'Knowledge of CI/CD pipelines', 'bhj', 8, 'xcx', 'Full-time', 'CloudBase is hiring a Full Stack Developer with strong Node.js and React skills to help build our next-generation cloud platform.\n\nResponsibilities:\n- Develop RESTful APIs using Node.js and Express\n- Build responsive frontends with React\n- Manage databases (MySQL, MongoDB)\n- Deploy applications on AWS\n\nRequirements:\n- 3+ years full stack experience\n- Proficiency in Node.js, Express, React\n- Experience with cloud platforms (AWS/GCP)\n- Knowledge of CI/CD pipelines\n\nBenefits:\n- Salary $85,000 - $110,000\n- Stock options\n- Flexible hours\n- Remote friendly', '+923083993052', '14155550401', 'shahzadali33389@gmail.com', NULL, '{\"fld_1772194499001_uif\":\"20\"}', 'active', 0, NULL, 1, 7, 'knowledge-of-cicd-pipelines', '2026-02-27 12:17:10', '2026-02-27 18:08:04');

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unread',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `name`, `email`, `phone`, `company`, `subject`, `message`, `status`, `created_at`) VALUES
(1, 'Shahzad Ali', 'shahzadali33389@gmail.com', '+921234567890', 'Toori', 'Post a Job Listing', 'CloudBase is hiring a Full Stack Developer with strong Node.js and React skills to help build our next-generation cloud platform.\n\nResponsibilities:\n- Develop RESTful APIs using Node.js and Express\n- Build responsive frontends with React\n- Manage databases (MySQL, MongoDB)\n- Deploy applications on AWS\n\nRequirements:\n- 3+ years full stack experience\n- Proficiency in Node.js, Express, React\n- Experience with cloud platforms (AWS/GCP)\n- Knowledge of CI/CD pipelines\n\nBenefits:\n- Salary $85,000 - $110,000\n- Stock options\n- Flexible hours\n- Remote friendly', 'read', '2026-02-24 10:22:05');

-- --------------------------------------------------------

--
-- Table structure for table `monetization`
--

CREATE TABLE `monetization` (
  `id` int(11) NOT NULL,
  `feature` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `duration_days` int(11) NOT NULL DEFAULT 30,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `monetization`
--

INSERT INTO `monetization` (`id`, `feature`, `enabled`, `price`, `duration_days`, `description`) VALUES
(1, 'featured_job', 1, '9.99', 30, 'Highlight job in featured section'),
(2, 'sponsored_top', 1, '19.99', 14, 'Pin job at top of listings'),
(3, 'banner_top', 1, '29.99', 30, 'Top banner ad space'),
(4, 'banner_sidebar', 1, '14.99', 30, 'Sidebar banner ad space');

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`key`, `value`) VALUES
('default_theme', 'light'),
('form_schema_v2', '{\"sections\":[{\"id\":\"sec_details\",\"title\":\"Job Details\",\"visible\":true,\"icon\":\"briefcase\",\"fields\":[{\"id\":\"fld_title\",\"coreKey\":\"title\",\"label\":\"Job Title\",\"labelSize\":\"sm\",\"labelBold\":true,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"text\",\"placeholder\":\"e.g. Senior Frontend Developer\",\"required\":true,\"visible\":true,\"width\":\"full\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_company\",\"coreKey\":\"company\",\"label\":\"Company Name\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"text\",\"placeholder\":\"e.g. Tech Corp Ltd\",\"required\":true,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_location\",\"coreKey\":\"location\",\"label\":\"Location\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"text\",\"placeholder\":\"e.g. Jubail, Riyadh or Remote\",\"required\":true,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_category\",\"coreKey\":\"category_id\",\"label\":\"Category\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"category\",\"placeholder\":\"\",\"required\":true,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_jobtype\",\"coreKey\":\"job_type\",\"label\":\"Job Type\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"jobtype\",\"placeholder\":\"\",\"required\":false,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_desc\",\"coreKey\":\"description\",\"label\":\"Description\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"textarea\",\"placeholder\":\"Describe the role, responsibilities, requirements...\",\"required\":true,\"visible\":true,\"width\":\"full\",\"helpText\":\"Be detailed - more info means better matches.\",\"options\":[]},{\"id\":\"fld_1772194499001_uif\",\"coreKey\":null,\"label\":\"Rate\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"text\",\"placeholder\":\"Rate per Houre\",\"required\":false,\"visible\":true,\"width\":\"third\",\"helpText\":\"\",\"options\":[]}]},{\"id\":\"sec_contact\",\"title\":\"Contact Information\",\"visible\":true,\"icon\":\"telephone\",\"fields\":[{\"id\":\"fld_phone\",\"coreKey\":\"phone\",\"label\":\"Phone\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"tel\",\"placeholder\":\"+1 555 000 0000\",\"required\":false,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_wa\",\"coreKey\":\"whatsapp\",\"label\":\"WhatsApp\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"tel\",\"placeholder\":\"+1 555 000 0000\",\"required\":false,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_email\",\"coreKey\":\"email\",\"label\":\"Email\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"email\",\"placeholder\":\"jobs@company.com\",\"required\":false,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]},{\"id\":\"fld_maplink\",\"coreKey\":\"map_link\",\"label\":\"Map Location Link\",\"labelSize\":\"sm\",\"labelBold\":false,\"labelItalic\":false,\"labelColor\":\"#000000\",\"type\":\"url\",\"placeholder\":\"https://maps.google.com/?q=...\",\"required\":false,\"visible\":true,\"width\":\"half\",\"helpText\":\"\",\"options\":[]}]}]}'),
('hero_subtitle', 'Browse thousands of opportunities and connect directly with recruiters.'),
('hero_title', 'Discover Jobs That Matter'),
('jobs_per_page', '12'),
('logo_url', ''),
('primary_color', '#0f62fe'),
('secondary_color', '#161616'),
('show_banner_side', '1'),
('show_banner_top', '1'),
('show_featured', '1'),
('show_sponsored', '1'),
('site_name', 'HireHub'),
('site_tagline', 'Find Your Next Opportunity');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `ad_placements`
--
ALTER TABLE `ad_placements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_jobs_status` (`status`),
  ADD KEY `idx_jobs_featured` (`featured`),
  ADD KEY `idx_jobs_category` (`category_id`),
  ADD KEY `idx_jobs_created` (`created_at`);
ALTER TABLE `jobs` ADD FULLTEXT KEY `idx_jobs_ft` (`title`,`company`,`description`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_messages_status` (`status`),
  ADD KEY `idx_messages_created` (`created_at`);

--
-- Indexes for table `monetization`
--
ALTER TABLE `monetization`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `feature` (`feature`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`key`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `ad_placements`
--
ALTER TABLE `ad_placements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `monetization`
--
ALTER TABLE `monetization`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `jobs`
--
ALTER TABLE `jobs`
  ADD CONSTRAINT `fk_jobs_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
