#!/usr/bin/env bash
# Lab 01 — Arrays y Strings Avanzados
# Objetivo: practicar manipulación de datos en Bash
set -euo pipefail

echo "=== LAB 01: Arrays y Strings ==="

# ── EJERCICIO 1: Inventario de servidores ──────────────────────────
echo -e "\n--- Ejercicio 1: Inventario ---"
declare -A servidores=(
    [web-01]="10.0.1.1"
    [web-02]="10.0.1.2"
    [db-01]="10.0.2.1"
    [cache-01]="10.0.3.1"
)

echo "Servidores web:"
for nombre in "${!servidores[@]}"; do
    [[ "$nombre" == web-* ]] && echo "  $nombre → ${servidores[$nombre]}"
done

# ── EJERCICIO 2: Parsear logs ──────────────────────────────────────
echo -e "\n--- Ejercicio 2: Parsear logs ---"
# Simular líneas de log
declare -a logs=(
    "2024-01-15T10:23:45Z ERROR Connection refused to 10.0.2.1:5432"
    "2024-01-15T10:23:46Z INFO  Request processed in 234ms"
    "2024-01-15T10:23:47Z ERROR Timeout after 30s"
    "2024-01-15T10:23:48Z WARN  Memory usage 85%"
    "2024-01-15T10:23:49Z INFO  Health check OK"
)

errores=0
for linea in "${logs[@]}"; do
    nivel="${linea#* }"          # quitar timestamp
    nivel="${nivel%% *}"         # quedarse solo con el nivel
    nivel="${nivel// /}"         # trim espacios

    if [[ "$nivel" == "ERROR" ]]; then
        mensaje="${linea#* * }"  # quitar timestamp y nivel
        echo "⚠️  $mensaje"
        (( errores++ ))
    fi
done
echo "Total errores encontrados: $errores"

# ── EJERCICIO 3: Transformar IPs ──────────────────────────────────
echo -e "\n--- Ejercicio 3: Calcular rangos de red ---"
calcular_red() {
    local ip="$1"
    local cidr="$2"

    IFS='.' read -ra octetos <<< "$ip"
    local ip_decimal=$((
        (octetos[0] << 24) +
        (octetos[1] << 16) +
        (octetos[2] << 8) +
        octetos[3]
    ))

    local mascara=$(( 0xFFFFFFFF << (32 - cidr) & 0xFFFFFFFF ))
    local red=$(( ip_decimal & mascara ))
    local broadcast=$(( red | (~mascara & 0xFFFFFFFF) ))
    local hosts=$(( broadcast - red - 1 ))

    printf "Red: %d.%d.%d.%d\n" \
        $(( (red >> 24) & 0xFF )) \
        $(( (red >> 16) & 0xFF )) \
        $(( (red >> 8) & 0xFF )) \
        $(( red & 0xFF ))
    echo "Hosts disponibles: $hosts"
}

calcular_red "192.168.1.50" 24
calcular_red "10.0.0.0" 16

echo -e "\n✅ Lab completado"
