# Replaces Stripe-like secret pattern in SECURITY_GUARDRAILS.md (for git filter-branch / history rewrite)
$path = "docs/active/SECURITY_GUARDRAILS.md"
if (Test-Path $path) {
    (Get-Content $path -Raw) -replace 'sk_test_[^"]*', '<redacted>' | Set-Content $path -NoNewline
}
