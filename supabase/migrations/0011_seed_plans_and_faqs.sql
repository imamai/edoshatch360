-- Subscription plans (spec §47). Prices are rows, not constants — the admin
-- CMS edits these and the marketing pricing page re-renders.
insert into edoshatch360_plans
  (code, name, tagline, description, price_cents, currency, billing_period,
   max_farms, max_houses, max_birds, max_users, features, is_popular, sort_order)
values
  ('starter', 'Starter', 'For the farmer getting organised',
   'Everything you need to know your birds, your feed and your money. Free while you grow.',
   0, 'KES', 'month', 1, 2, 500, 2,
   '["1 farm, up to 2 houses","Up to 500 birds","Daily records & mortality tracking","Egg production log","Feed & expense tracking","Simple profit view","Works offline","Mobile app (PWA)"]'::jsonb,
   false, 1),

  ('growth', 'Growth', 'For the commercial farmer',
   'Full production, health and financial intelligence for a farm you run as a business.',
   250000, 'KES', 'month', 1, 10, 5000, 5,
   '["1 farm, up to 10 houses","Up to 5,000 birds","Everything in Starter","Flock profitability & FCR","Vaccination scheduling & reminders","Inventory & reorder alerts","Customers, invoices & receipts","Farm Health Score","Production & financial reports (PDF/Excel)","SMS alerts"]'::jsonb,
   true, 2),

  ('professional', 'Professional', 'For the multi-farm business',
   'Run several farms, several teams and several flocks from one place — and compare them all.',
   750000, 'KES', 'month', 5, null, 50000, 20,
   '["Up to 5 farms, unlimited houses","Up to 50,000 birds","Everything in Growth","Multi-farm dashboard & comparison","Role-based staff accounts","Farm manager assignments","Benchmarking vs previous batches","Custom reports","Audit log","eTIMS-ready tax invoices","Priority support"]'::jsonb,
   false, 3),

  ('enterprise', 'Enterprise', 'For poultry companies & networks',
   'Unlimited scale, your own branding, and support for organisations managing farmer networks.',
   0, 'KES', 'month', null, null, null, null,
   '["Unlimited farms, houses & birds","Unlimited users","Everything in Professional","Farmer network management","White-label branding","API access","Dedicated onboarding & training","Service level agreement","Custom integrations"]'::jsonb,
   false, 4);

insert into edoshatch360_cms_faqs (category, question, answer, sort_order) values
  ('general', 'Do I need internet to record my daily data?',
   'No. EDOS Hatch360 saves your records on your phone first, then syncs them the moment you have signal again. You will see a small badge showing whether a record is synced or still pending — nothing is ever lost because the network dropped.', 1),
  ('general', 'I only have one house and about 300 birds. Is this too big for me?',
   'Not at all. New accounts start in Simple mode, which shows only birds, eggs, feed, sales, expenses and profit. Advanced tools like feed conversion, production curves and benchmarking stay hidden until you switch them on.', 2),
  ('general', 'Which birds does it handle?',
   'Broilers, layers, kienyeji, improved kienyeji, breeders, chicks, pullets and turkey. You can also add your own category if you keep something else.', 3),
  ('pricing', 'Is the Starter plan really free?',
   'Yes — one farm, up to two houses and 500 birds, at no cost, for as long as you need it. You only pay when your farm outgrows it.', 4),
  ('pricing', 'How do I pay?',
   'M-Pesa. You will get an STK push on the number attached to your account. Card payments are coming for customers outside Kenya.', 5),
  ('pricing', 'Can I change plans later?',
   'Any time, up or down. Your data stays exactly as it is — only the limits and the features available to you change.', 6),
  ('multi', 'I manage farms for other farmers. Does that work?',
   'Yes. On Professional and Enterprise you can hold several farms under one account, assign a manager to specific farms only, and see a network view comparing birds, eggs, mortality and profit across all of them.', 7),
  ('multi', 'Can my workers record data without seeing my money?',
   'Yes. Roles control what each person sees. A farm worker gets the recording screens and their tasks; only owners and accountants see revenue, expenses and profit.', 8),
  ('data', 'Who can see my farm data?',
   'Only you and the people you invite. Every record is isolated to your organisation at the database level, not just in the app — there is no query anyone outside your organisation can run that returns your rows.', 9),
  ('data', 'Can I get my data out?',
   'Yes. Every report exports to PDF, Excel or CSV, and you can export your full records at any time. It is your data.', 10);

insert into edoshatch360_cms_testimonials (name, role, company, location, quote, rating, sort_order) values
  ('Mwangi K.', 'Layer farmer', null, 'Kiambu County',
   'I used to know my egg numbers only at the end of the month, when the money was already spent. Now I see the drop the same week it starts.', 5, 1),
  ('Achieng O.', 'Farm manager', 'Sunrise Poultry', 'Kisumu County',
   'Three houses, three different workers, one screen. I stopped chasing people for notebooks.', 5, 2),
  ('Kipkoech R.', 'Broiler producer', null, 'Uasin Gishu County',
   'The feed conversion number told me which batch was actually making money. Turns out it was not the biggest one.', 5, 3),
  ('Wanjiru N.', 'Kienyeji farmer', null, 'Nyeri County',
   'It did not ask me for twenty things. Birds, eggs, feed, sales. That is how I actually keep my records.', 5, 4);
