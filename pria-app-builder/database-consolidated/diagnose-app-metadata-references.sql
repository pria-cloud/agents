-- =============================================================================
-- Diagnostic Script: Find ALL app_metadata references in the database
-- =============================================================================
-- This will help us identify what's still trying to access app_metadata

-- 1. Check for functions that reference app_metadata
SELECT 
    schemaname,
    proname as function_name,
    prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE prosrc ILIKE '%app_metadata%'
ORDER BY schemaname, proname;

-- 2. Check for views that reference app_metadata
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition ILIKE '%app_metadata%'
ORDER BY schemaname, viewname;

-- 3. Check for triggers on workspace_members table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'workspace_members'
AND event_object_schema = 'app_builder';

-- 4. Check for RLS policies on workspace_members table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'workspace_members'
AND schemaname = 'app_builder';

-- 5. Check for check constraints that might reference app_metadata
SELECT 
    constraint_name,
    table_name,
    check_clause
FROM information_schema.check_constraints
WHERE table_name = 'workspace_members'
OR check_clause ILIKE '%app_metadata%';

-- 6. List all functions in app_builder schema
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'app_builder'
ORDER BY routine_name;