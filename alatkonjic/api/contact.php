<?php
// Alat d.o.o. Konjic — obrada kontakt forme (za hosting s PHP podrškom).
// Ako PHP nije dostupan (npr. GitHub Pages), forma automatski otvara email klijent (mailto).
header('Content-Type: application/json; charset=utf-8');

$TO = 'info@alatkonjic.com';
$FROM = 'noreply@alatkonjic.com';

function out($ok, $err = '') { http_response_code($ok ? 200 : 400); echo json_encode(['ok' => $ok, 'error' => $err]); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(false, 'method');
if (!empty($_POST['website'])) out(true);                              // honeypot
if (isset($_POST['elapsed']) && (int)$_POST['elapsed'] < 2500) out(false, 'too_fast');

$clean = function ($k, $max = 500) { return trim(mb_substr(str_replace(["\r", "\n"], ' ', (string)($_POST[$k] ?? '')), 0, $max)); };
$name    = $clean('name', 120);
$email   = filter_var($clean('email', 160), FILTER_VALIDATE_EMAIL);
$phone   = $clean('phone', 60);
$subject = $clean('subject', 160) ?: 'Upit sa web stranice';
$message = trim(mb_substr((string)($_POST['message'] ?? ''), 0, 5000));
$consent = !empty($_POST['consent']);

if (!$name || !$email || !$message || !$consent) out(false, 'validation');

$body = "Novi upit sa alatkonjic.com\n\n"
      . "Ime i prezime: $name\nEmail: $email\nTelefon: " . ($phone ?: '-') . "\nPredmet: $subject\n\n"
      . "Poruka:\n$message\n\n---\nIP: " . ($_SERVER['REMOTE_ADDR'] ?? '') . "\nVrijeme: " . date('d.m.Y H:i');

$headers = "From: Alat Konjic web <$FROM>\r\nReply-To: $name <$email>\r\nContent-Type: text/plain; charset=UTF-8\r\n";
$ok = @mail($TO, '=?UTF-8?B?' . base64_encode('[Web upit] ' . $subject) . '?=', $body, $headers);
out((bool)$ok, $ok ? '' : 'mail');
