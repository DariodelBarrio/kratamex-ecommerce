# Cheatsheet — Bash Avanzado

## Expansión de Parámetros
| Sintaxis | Resultado |
|----------|-----------|
| `${var:-default}` | valor o default si vacía |
| `${var:=default}` | asigna y retorna default si vacía |
| `${var:?mensaje}` | error si vacía |
| `${var:+otro}` | `otro` si var tiene valor |
| `${#var}` | longitud del string |
| `${var:offset:len}` | substring |
| `${var##patrón}` | quitar prefijo más largo |
| `${var%%patrón}` | quitar sufijo más largo |
| `${var/pat/rep}` | reemplazar primera ocurrencia |
| `${var//pat/rep}` | reemplazar todas |
| `${var^^}` | MAYÚSCULAS |
| `${var,,}` | minúsculas |

## Set Options
```bash
set -e          # exit on error
set -u          # error on undefined var
set -o pipefail # error en pipes
set -x          # debug mode (trace)
```

## Arrays
```bash
arr=(a b c)
${arr[@]}       # todos los elementos
${arr[0]}       # primer elemento
${#arr[@]}      # longitud
${arr[@]:1:2}   # slice
arr+=(d)        # append
unset arr[2]    # eliminar elemento
```

## Traps
```bash
trap 'cleanup' EXIT
trap 'echo INT' INT
trap 'echo TERM' TERM
trap '' SIGPIPE  # ignorar
```

## Test / Condicionales
```bash
[[ -f file ]]       # es archivo
[[ -d dir ]]        # es directorio
[[ -z "$var" ]]     # string vacío
[[ -n "$var" ]]     # string no vacío
[[ -v VAR ]]        # variable declarada
[[ "$a" =~ regex ]] # regex match
(( a > b ))         # aritmético
```

## Procesos
```bash
cmd &           # background
$!              # PID último background
wait            # esperar todos los jobs
wait $pid       # esperar PID específico
jobs -r         # jobs en ejecución
kill -0 $pid    # verificar si proceso existe
```
