#!/usr/bin/env bash

set -- $(locale LC_MESSAGES)
yesptrn="$1"; noptrn="$2"; yesword="$3"; noword="$4"
node_modules=false
documentation_only=false
include_documentation=false

function join_by { local IFS="$1"; shift; echo "$*"; }

while true; do
    read -p "Do you want to include the node_modules (${yesword} / ${noword})? " yn
    case $yn in
        ${yesptrn##^} ) node_modules=true; break;;
        ${noptrn##^} ) node_modules=false; break;;
        * ) echo "Answer ${yesword} / ${noword}.";;
    esac
done

files=("*")
files_string="$(join_by " " "${files[@]}")"

if [ "$node_modules" = false ]; then
  files_string="${files_string[@]//node_modules/""}"
  # tar -czvf bitbeat_$(date +'%F_%H-%M-%S').tar.gz $files_string --exclude=node_modules
  echo $files_string --exclude=node_modules
else
  files_string="$(join_by " " "${files[@]}")"
  tar -czvf bitbeat_$(date +'%F_%H-%M-%S').tar.gz $files_string
fi;