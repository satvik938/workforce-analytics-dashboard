-- Workforce metrics (PostgreSQL syntax)
-- Source table mirrors data/raw/hr_employees.csv:
--   employees(employee_id, department, hire_date DATE, term_date DATE NULL, term_type,
--             salary, engagement, days_to_fill)

-- 1. Monthly headcount, hires, separations and turnover rate
WITH months AS (
    SELECT generate_series(DATE '2025-11-01', DATE '2026-10-01', INTERVAL '1 month')::date AS m_start
),
m AS (
    SELECT m_start, (m_start + INTERVAL '1 month - 1 day')::date AS m_end FROM months
)
SELECT
    to_char(m.m_start, 'YYYY-MM') AS month,
    COUNT(*) FILTER (WHERE e.hire_date <= m.m_end AND (e.term_date IS NULL OR e.term_date > m.m_end))  AS headcount,
    COUNT(*) FILTER (WHERE e.hire_date BETWEEN m.m_start AND m.m_end)                                  AS hires,
    COUNT(*) FILTER (WHERE e.term_date BETWEEN m.m_start AND m.m_end)                                  AS separations,
    COUNT(*) FILTER (WHERE e.term_date BETWEEN m.m_start AND m.m_end AND e.term_type = 'Voluntary')    AS voluntary,
    ROUND(100.0 * COUNT(*) FILTER (WHERE e.term_date BETWEEN m.m_start AND m.m_end)
          / NULLIF((COUNT(*) FILTER (WHERE e.hire_date <= m.m_end AND (e.term_date IS NULL OR e.term_date > m.m_end))
                  + COUNT(*) FILTER (WHERE e.hire_date <  m.m_start AND (e.term_date IS NULL OR e.term_date >= m.m_start))) / 2.0, 0), 2) AS turnover_pct
FROM m CROSS JOIN employees e
GROUP BY m.m_start, m.m_end
ORDER BY m.m_start;

-- 2. Department snapshot: active headcount at period end and 12-month turnover
WITH active AS (
    SELECT * FROM employees
    WHERE hire_date <= DATE '2026-10-31' AND (term_date IS NULL OR term_date > DATE '2026-10-31')
),
seps AS (
    SELECT department, COUNT(*) AS separations_12m
    FROM employees
    WHERE term_date BETWEEN DATE '2025-11-01' AND DATE '2026-10-31'
    GROUP BY department
)
SELECT
    a.department,
    COUNT(*)                                                         AS headcount,
    COALESCE(s.separations_12m, 0)                                   AS separations_12m,
    ROUND(100.0 * COALESCE(s.separations_12m, 0) / COUNT(*), 1)      AS turnover_12m_pct,
    ROUND(AVG(a.salary), -2)                                         AS avg_salary,
    ROUND(AVG(a.engagement), 2)                                      AS engagement
FROM active a
LEFT JOIN seps s USING (department)
GROUP BY a.department, s.separations_12m
ORDER BY headcount DESC;

-- 3. Average days to fill by department (hires in the last 12 months)
SELECT department, ROUND(AVG(days_to_fill), 1) AS avg_days_to_fill
FROM employees
WHERE hire_date >= DATE '2025-11-01'
GROUP BY department
ORDER BY avg_days_to_fill DESC;

-- 4. Tenure mix of active employees
--    (Python uses 365.25-day years, so a person right on a year boundary can land one band apart.)
SELECT
    CASE
        WHEN age(DATE '2026-10-31', hire_date) <  INTERVAL '1 year'  THEN '< 1 yr'
        WHEN age(DATE '2026-10-31', hire_date) <  INTERVAL '2 years' THEN '1-2 yrs'
        WHEN age(DATE '2026-10-31', hire_date) <  INTERVAL '5 years' THEN '2-5 yrs'
        WHEN age(DATE '2026-10-31', hire_date) < INTERVAL '10 years' THEN '5-10 yrs'
        ELSE '10+ yrs'
    END AS tenure_band,
    COUNT(*) AS employees,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS share_pct
FROM employees
WHERE hire_date <= DATE '2026-10-31' AND (term_date IS NULL OR term_date > DATE '2026-10-31')
GROUP BY tenure_band
ORDER BY MIN(hire_date) DESC;
