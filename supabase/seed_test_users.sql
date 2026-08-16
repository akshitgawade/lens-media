-- Run this in your Supabase Dashboard SQL Editor to bypass the signup rate limit and seed the users directly.
-- This inserts the users into the auth schema and auto-confirms their emails so they can log in immediately.

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES
    (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'email1@gmail.com',
        crypt('email1', gen_salt('bf')),
        current_timestamp,
        current_timestamp,
        current_timestamp,
        '{"provider":"email","providers":["email"]}',
        '{}',
        current_timestamp,
        current_timestamp,
        '',
        '',
        '',
        ''
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'email2@gmail.com',
        crypt('email2', gen_salt('bf')),
        current_timestamp,
        current_timestamp,
        current_timestamp,
        '{"provider":"email","providers":["email"]}',
        '{}',
        current_timestamp,
        current_timestamp,
        '',
        '',
        '',
        ''
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'email3@gmail.com',
        crypt('email3', gen_salt('bf')),
        current_timestamp,
        current_timestamp,
        current_timestamp,
        '{"provider":"email","providers":["email"]}',
        '{}',
        current_timestamp,
        current_timestamp,
        '',
        '',
        '',
        ''
    );

-- Also add them to auth.identities so Supabase recognizes their email provider properly
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    id,
    id::text,
    jsonb_build_object('sub', id, 'email', email),
    'email',
    current_timestamp,
    current_timestamp,
    current_timestamp
FROM auth.users
WHERE email IN ('email1@gmail.com', 'email2@gmail.com', 'email3@gmail.com')
ON CONFLICT DO NOTHING;
