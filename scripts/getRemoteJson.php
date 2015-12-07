<?php
/**
 * Simuluje REST komunikaci, pokud je klient na jiné doméně (a sever nemá Access-Control-Allow-Origin)
 */
$url = $_GET['resource'];
$curl = curl_init($url);
curl_setopt($curl, CURLOPT_RETURNTRANSFER, TRUE);
$output = curl_exec($curl);
curl_close($curl);
echo $output;