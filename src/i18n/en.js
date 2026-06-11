// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // Navigation
  nav_accueil: 'Home', nav_patrimoine: 'Portfolio', nav_budget: 'Budget',
  nav_flux: 'Cash Flow', nav_investir: 'Invest', nav_ia: 'AI',

  // Header menu
  menu_profile: 'User Profile', menu_display_name: 'Display Name',
  menu_edit_profile: 'Edit my profile', menu_appearance: 'Appearance',
  menu_theme: 'Theme', menu_dark: 'Dark', menu_light: 'Light', menu_color: 'Color',
  menu_settings: 'Settings', menu_currency: 'Currency', menu_language: 'Language',
  menu_date_format: 'Date format', menu_notifications: 'Notifications',
  menu_notif_on: 'Enabled', menu_notif_off: 'Disabled',
  menu_data: 'Data', menu_export_json: 'Export JSON',
  menu_export_csv: 'Export transactions CSV', menu_import_json: 'Import JSON data',
  menu_delete_account: 'Delete my account',
  menu_delete_confirm: 'Permanently delete all your data?',
  menu_confirm: 'Confirm', menu_about: 'About', menu_version: 'Version',
  menu_legal: 'Legal notice', menu_privacy: 'Privacy policy',
  menu_logout: 'Sign out', menu_login: 'Sign in',
  menu_save: 'Save', menu_cancel: 'Cancel',
  menu_demo_data: 'Demo data',
  menu_import_ok: '✅ Import successful!', menu_import_err: '❌ Invalid file',

  // Common
  add: 'Add', edit: 'Edit', delete: 'Delete',
  cancel: 'Cancel', save: 'Save', close: 'Close',
  back: '← Back', loading: 'Loading…',

  // Accueil
  accueil_patrimoine_total: 'Total Net Worth',
  accueil_net_value: 'net value', accueil_gross: 'Gross', accueil_immo_debt: 'Real estate debt',
  accueil_revenus_mois: 'Monthly income', accueil_epargne_rate: 'Savings rate',
  accueil_saved: 'saved', accueil_health_score: 'Health score',
  accueil_repartition: 'Wealth breakdown',
  accueil_investissements: 'Investments', accueil_investissements_net: 'Investments (net)',
  accueil_epargne_cash: 'Savings & Cash', accueil_materiel: 'Physical assets',
  accueil_depenses: 'Expenses this month', accueil_no_expense: 'No expenses this month',
  accueil_objectifs: 'Financial goals', accueil_see_all: 'See all →',
  accueil_last_tx: 'Recent transactions',
  accueil_no_tx: 'No transactions — go to Cash Flow to add some',
  accueil_on: 'over', accueil_months: 'months',

  // Patrimoine sections
  pat_invest: '◈ Investments', pat_cash: '🏦 Savings & Cash',
  pat_materiel: '📦 Assets', pat_loans: '🏠 Mortgages', pat_projection: '📊 Projection',

  // Patrimoine page
  pat_title: 'Portfolio', pat_total: 'Total', pat_brut: 'Gross', pat_net: 'Net',
  pat_after_debt: '(after debt)', pat_add_envelope: '+ Portfolio',
  pat_actifs_fin: 'Financial assets', pat_capital_investi: 'Invested capital',
  pat_plus_values: 'Capital gains', pat_performance: 'Performance',
  pat_no_envelope: 'No portfolio',
  pat_add_immo: 'Add your brokerage account, insurance, crypto or real estate',
  pat_allocation: 'Allocation', pat_envelopes: 'Portfolios',
  pat_details: 'Details', pat_div_global: 'Dividends — global view',
  pat_div_all: 'All payments, all portfolios',

  // Investments detail
  inv_current_value: 'Current value', inv_capital: 'Invested capital',
  inv_pnl: 'Capital gain', inv_perf: 'Performance', inv_details: 'Details',
  inv_positions: 'Positions', inv_dividends: 'Dividends',
  inv_no_positions: 'No positions — click "+ Position" to add',
  inv_add_position: '+ Position', inv_add_dividend: '+ Dividend',
  inv_no_dividends: 'No dividends recorded',
  inv_total_year: '{0} total', inv_payments: 'Payments', inv_total_received: 'Total received',
  inv_financing: 'Financing', inv_capital_remaining: 'Outstanding balance',
  inv_net_value: 'Net value', inv_monthly_payment: 'Monthly payment (total)',
  inv_effort: 'Monthly effort', inv_effort_hint: 'Rent − payment − charges',
  inv_brut_yield: 'Gross yield', inv_net_cashflow: 'Net cashflow',
  inv_rent: 'Rent', inv_charges: 'Charges',

  // Cash / Savings
  cash_total: 'Total savings & cash', cash_interests: 'Annual interest',
  cash_avg_rate: 'Average rate', cash_nb_accounts: 'Nb of accounts',
  cash_add: '+ Account', cash_no_accounts: 'No accounts',
  cash_add_hint: 'Add your savings accounts, checking accounts…',
  cash_cap_exceeded: '⚠ Cap exceeded', cash_non_rem: 'Non-yielding',
  cash_remaining: 'Remaining', cash_exceeded: 'Exceeded by',

  // Loans
  loan_capital_remaining: 'Outstanding balance', loan_monthly: 'Total monthly payments',
  loan_nb: 'Nb of loans', loan_add: '+ Mortgage', loan_no_loans: 'No mortgage',
  loan_no_loans_hint: 'Add your mortgage to track the outstanding balance and monthly payments',
  loan_remaining_duration: 'Remaining term', loan_remaining_cost: 'Remaining loan cost',
  loan_insurance: 'Insurance', loan_repaid: 'Repaid',
  loan_simulator: 'Early repayment simulator',
  loan_months_saved: 'Months saved', loan_interest_saved: 'Interest saved',
  loan_new_end: 'New end date', loan_months: 'months',

  // Projection
  proj_title: 'Compound Interest Simulator', proj_duration: 'Duration',
  proj_rate: 'Annual return', proj_monthly_contrib: 'Monthly contribution',
  proj_start: 'Starting capital', proj_in_n_years: 'In {0} years',
  proj_total_payments: 'Total contributions', proj_interests: 'Generated interest',
  proj_evolution: 'Wealth growth', proj_milestones: 'Key milestones',
  proj_no_return: 'Without return', proj_with_return: 'With return',
  proj_years: 'years', proj_in: 'In', proj_times: '×',

  // Materiel
  mat_total_value: 'Total value', mat_acquisition_cost: 'Acquisition cost',
  mat_pnl: 'Gain / Loss', mat_nb_assets: 'Nb of assets',
  mat_add_asset: '+ Physical asset', mat_add_listing: '+ For sale item',
  mat_repartition: 'Breakdown', mat_assets: 'Physical assets',
  mat_for_sale: 'Items for sale ({0})', mat_expected_profit: 'Expected profit',
  mat_sold: 'Sold items ({0})', mat_realized: 'realized',
  mat_sold_today: 'Today', mat_gains_year: '{0} gains',
  mat_gains_total: 'Total realized gains',

  // Live prices
  live_updating: '⟳ Updating…', live_ok: 'LIVE',
  live_error: '⚠ Price server down',

  // Misc
  misc_months: 'months', misc_per_month: '/month', misc_per_year: '/ year',
};
