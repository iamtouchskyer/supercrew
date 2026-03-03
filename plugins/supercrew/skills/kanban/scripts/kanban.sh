#!/usr/bin/env bash
# kanban.sh — Display .supercrew/features as a kanban board

set -euo pipefail

FEATURES_DIR=".supercrew/features"

if [ ! -d "$FEATURES_DIR" ]; then
    echo "No \`.supercrew/features/\` directory found in this project."
    echo ""
    echo "Get started with \`/supercrew:new-feature\` to create your first feature."
    exit 0
fi

# Parse a YAML scalar value (handles quoted and unquoted)
yaml_val() {
    local content="$1" key="$2"
    local raw
    raw=$(echo "$content" | grep "^${key}:" | head -1 | sed "s/^${key}: *//" )
    # Strip surrounding quotes
    raw="${raw#\"}"
    raw="${raw%\"}"
    raw="${raw#\'}"
    raw="${raw%\'}"
    printf '%s' "$raw"
}

# Parse a YAML inline list: blocked_by: [item1, item2]
yaml_list() {
    local content="$1" key="$2"
    local raw
    raw=$(echo "$content" | grep "^${key}:" | head -1 | sed "s/^${key}: *//" )
    raw="${raw#\[}"
    raw="${raw%\]}"
    # Strip quotes and commas, collapse whitespace
    raw=$(echo "$raw" | sed 's/,/ /g; s/"//g; s/'"'"'//g' | xargs 2>/dev/null || echo "")
    printf '%s' "$raw"
}

# Field separator (unit separator, non-whitespace so read won't collapse empty fields)
SEP=$'\x1f'

# Temp file for collecting feature data
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE" "${TMPFILE}".feat* "${TMPFILE}".sorted' EXIT

feature_count=0

for feature_dir in "$FEATURES_DIR"/*/; do
    [ -d "$feature_dir" ] || continue

    fid=$(basename "$feature_dir")
    meta_file="$feature_dir/meta.yaml"
    [ -f "$meta_file" ] || continue

    feature_count=$((feature_count + 1))

    # Read local meta.yaml
    meta_content=$(cat "$meta_file")

    # If feature has a branch field, try git show for latest version
    branch=$(yaml_val "$meta_content" "branch")
    if [ -n "$branch" ]; then
        remote_meta=$(git show "${branch}:${FEATURES_DIR}/${fid}/meta.yaml" 2>/dev/null || echo "")
        if [ -n "$remote_meta" ]; then
            meta_content="$remote_meta"
        fi
    fi

    title=$(yaml_val "$meta_content" "title")
    status=$(yaml_val "$meta_content" "status")
    priority=$(yaml_val "$meta_content" "priority")
    owner=$(yaml_val "$meta_content" "owner")
    blocked_by=$(yaml_list "$meta_content" "blocked_by")

    # Get progress from plan.md (try branch version first)
    progress=""
    plan_content=""
    if [ -n "$branch" ]; then
        plan_content=$(git show "${branch}:${FEATURES_DIR}/${fid}/plan.md" 2>/dev/null || echo "")
    fi
    if [ -z "$plan_content" ] && [ -f "$feature_dir/plan.md" ]; then
        plan_content=$(cat "$feature_dir/plan.md")
    fi
    if [ -n "$plan_content" ]; then
        progress=$(echo "$plan_content" | grep '^progress:' | sed 's/^progress: *//' | head -1)
    fi

    # Priority sort key (P0=0 .. P3=3, unknown=9)
    psort="${priority#P}"
    [[ "$psort" =~ ^[0-9]$ ]] || psort=9

    # Record: status | priority_sort | id | title | priority | progress | owner | blocked_by
    printf "%s${SEP}%s${SEP}%s${SEP}%s${SEP}%s${SEP}%s${SEP}%s${SEP}%s\n" \
        "$status" "$psort" "$fid" "$title" "$priority" "$progress" "$owner" "$blocked_by" \
        >> "$TMPFILE"
done

if [ "$feature_count" -eq 0 ]; then
    echo "No features found in \`.supercrew/features/\`."
    echo ""
    echo "Create your first feature with \`/supercrew:new-feature\`."
    exit 0
fi

# Sort by priority
sort -t"$SEP" -k2,2n "$TMPFILE" > "${TMPFILE}.sorted"
mv "${TMPFILE}.sorted" "$TMPFILE"

# ── Rendering ────────────────────────────────────────────────────────────────

# Colors on by default; set NO_COLOR=1 to disable
if [ -z "${NO_COLOR:-}" ]; then
    C_RESET=$'\e[0m'
    C_BOLD=$'\e[1m'
    C_DIM=$'\e[2m'
    C_RED=$'\e[31m'
    C_GREEN=$'\e[32m'
    C_YELLOW=$'\e[33m'
    C_MAGENTA=$'\e[35m'
    C_CYAN=$'\e[36m'
else
    C_RESET="" C_BOLD="" C_DIM="" C_RED="" C_GREEN="" C_YELLOW="" C_MAGENTA="" C_CYAN=""
fi

# Status display order
STATUS_ORDER=("planning" "designing" "ready" "active" "blocked" "done")

status_label() { printf '%s' "${1^}"; }

status_color() {
    case "$1" in
        planning)  printf '%s' "$C_DIM" ;;
        designing) printf '%s' "$C_MAGENTA" ;;
        ready)     printf '%s' "$C_CYAN" ;;
        active)    printf '%s' "$C_YELLOW" ;;
        blocked)   printf '%s' "$C_RED" ;;
        done)      printf '%s' "$C_GREEN" ;;
        *)         printf '' ;;
    esac
}

# Pad string to exact visible width (non-hot paths only; hot paths use inline printf -v)
pad_to() {
    local str="$1" width="$2"
    local len=${#str}
    if (( len >= width )); then
        printf '%s' "${str:0:$width}"
    else
        printf '%s%*s' "$str" $(( width - len )) ""
    fi
}

# ── Collect non-empty columns ───────────────────────────────────────────────

num_cols=0
declare -a col_statuses=()

for st in "${STATUS_ORDER[@]}"; do
    features=$(grep "^${st}${SEP}" "$TMPFILE" 2>/dev/null || true)
    [ -z "$features" ] && continue
    col_statuses+=("$st")
    echo "$features" > "${TMPFILE}.feat${num_cols}"
    num_cols=$((num_cols + 1))
done

# Warn about features with invalid or empty status
bad_features=$(grep -v -E "^($(IFS='|'; echo "${STATUS_ORDER[*]}"))${SEP}" "$TMPFILE" 2>/dev/null || true)
if [ -n "$bad_features" ]; then
    while IFS="$SEP" read -r bad_status _psort fid _rest; do
        if [ -z "$bad_status" ]; then
            printf '%sWarning:%s feature "%s" has no status\n' "$C_YELLOW" "$C_RESET" "$fid" >&2
        else
            printf '%sWarning:%s feature "%s" has unknown status "%s"\n' "$C_YELLOW" "$C_RESET" "$fid" "$bad_status" >&2
        fi
    done <<< "$bad_features"
fi

if [ "$num_cols" -eq 0 ]; then
    exit 0
fi

# ── Calculate column dimensions ─────────────────────────────────────────────

term_width=$(tput cols 2>/dev/null || echo 80)
col_total_width=$(( (term_width - num_cols - 1) / num_cols ))
col_width=$(( col_total_width - 2 ))
if (( col_width < 10 )); then
    col_width=10
    col_total_width=12
fi

# ── Build cell lines per column ─────────────────────────────────────────────

# Flat array: CELLS[col * MAX_ROWS + row] = "TYPE${SEP}text"
# Types: T=title(bold), M=meta(dim), B=blocker(red), S=separator
MAX_ROWS=500
declare -a CELLS=()
declare -a COL_LINE_COUNTS=()
max_lines=0

for (( c=0; c<num_cols; c++ )); do
    idx=0
    while IFS="$SEP" read -r _status _psort fid title priority progress owner blocked_by; do
        # Normalize owner @-prefix once
        if [ -n "$owner" ]; then
            [[ "$owner" == @* ]] || owner="@$owner"
        fi

        # Title (bold, truncated inline — no subshell)
        if (( ${#title} > col_width )); then
            trunc="${title:0:$((col_width - 1))}…"
        else
            trunc="$title"
        fi
        CELLS[$((c * MAX_ROWS + idx))]="T${SEP}$trunc"
        idx=$((idx + 1))

        # Meta: priority + progress bar, or priority + owner
        meta="$priority"
        if [ -n "$progress" ] && [ "$progress" != "0" ]; then
            # Inline progress bar (avoids subshell)
            _filled=$(( progress * 10 / 100 ))
            _empty=$(( 10 - _filled ))
            printf -v _bar_f '%*s' "$_filled" ""; _bar_f="${_bar_f// /▓}"
            printf -v _bar_e '%*s' "$_empty"  ""; _bar_e="${_bar_e// /░}"
            meta="$meta ${_bar_f}${_bar_e} ${progress}%"
        elif [ -n "$owner" ]; then
            meta="$meta · $owner"
        fi
        CELLS[$((c * MAX_ROWS + idx))]="M${SEP}$meta"
        idx=$((idx + 1))

        # Owner on separate line when progress bar was shown
        if [ -n "$progress" ] && [ "$progress" != "0" ] && [ -n "$owner" ]; then
            CELLS[$((c * MAX_ROWS + idx))]="M${SEP}$owner"
            idx=$((idx + 1))
        fi

        # Blocker line
        if [ -n "$blocked_by" ]; then
            CELLS[$((c * MAX_ROWS + idx))]="B${SEP}blocked: $blocked_by"
            idx=$((idx + 1))
        fi

        # Blank separator between features
        CELLS[$((c * MAX_ROWS + idx))]="S${SEP}"
        idx=$((idx + 1))
    done < "${TMPFILE}.feat${c}"

    COL_LINE_COUNTS[$c]=$idx
    (( idx > max_lines )) && max_lines=$idx
done

# ── Render table ────────────────────────────────────────────────────────────

# Horizontal rule segment (printf -v avoids loop and subshell)
printf -v hr '%*s' "$col_total_width" ""
hr="${hr// /─}"

# Draw a full-width border line: draw_border <left> <mid> <right>
draw_border() {
    local line="$1${hr}"
    for (( c=1; c<num_cols; c++ )); do line+="$2${hr}"; done
    printf '%s\n' "${line}$3"
}

draw_border "┌" "┬" "┐"

# Header row
line="│"
for (( c=0; c<num_cols; c++ )); do
    st="${col_statuses[$c]}"
    label=$(status_label "$st")
    color=$(status_color "$st")
    padded=$(pad_to "$label" "$col_width")
    line+=" ${color}${padded}${C_RESET} │"
done
printf '%s\n' "$line"

draw_border "├" "┼" "┤"

# Content rows (pad_to inlined to avoid subshell per cell)
printf -v empty_cell '%*s' "$col_width" ""
for (( r=0; r<max_lines; r++ )); do
    line="│"
    for (( c=0; c<num_cols; c++ )); do
        count=${COL_LINE_COUNTS[$c]}
        if (( r < count )); then
            cell="${CELLS[$((c * MAX_ROWS + r))]}"
            ctype="${cell%%${SEP}*}"
            content="${cell#*${SEP}}"
            len=${#content}
            if (( len >= col_width )); then
                padded="${content:0:$col_width}"
            else
                printf -v padded '%s%*s' "$content" $(( col_width - len )) ""
            fi
            case "$ctype" in
                T) line+=" ${C_BOLD}${padded}${C_RESET} │" ;;
                M) line+=" ${C_DIM}${padded}${C_RESET} │" ;;
                B) line+=" ${C_RED}${padded}${C_RESET} │" ;;
                *) line+=" ${padded} │" ;;
            esac
        else
            line+=" ${empty_cell} │"
        fi
    done
    printf '%s\n' "$line"
done

draw_border "└" "┴" "┘"
