#!/usr/bin/env bash

set -- $(locale LC_MESSAGES)
yesptrn="$1"; noptrn="$2"; yesword="$3"; noword="$4"
node_modules=false
documentation_only=false
include_documentation=false

function join_by { local IFS="$1"; shift; echo "$*"; }

while true; do
    read -p "Do you want to only zip the documentation (${yesword} / ${noword})? " yn
    case $yn in
        ${yesptrn##^} ) documentation_only=true; break;;
        ${noptrn##^} ) documentation_only=false; break;;
        * ) echo "Answer ${yesword} / ${noword}.";;
    esac
done

while true; do
    read -p "Do you want to include the node_modules (${yesword} / ${noword})? " yn
    case $yn in
        ${yesptrn##^} ) node_modules=true; break;;
        ${noptrn##^} ) node_modules=false; break;;
        * ) echo "Answer ${yesword} / ${noword}.";;
    esac
done

if [ "$documentation_only" = false ]; then
  while true; do
    read -p "Include the documentation (${yesword} / ${noword})? " yn
    case $yn in
        ${yesptrn##^} ) include_documentation=true; break;;
        ${noptrn##^} ) include_documentation=false; break;;
        * ) echo "Answer ${yesword} / ${noword}.";;
    esac
  done

  files=("package*.json" "LICENSE.md" "README.md" "index.js" "index.d.ts" "__core__/*.js" "__core__/*.d.ts" "__core__/**/*.js" "__core__/**/*.d.ts" "bin/*.js" "bin/*.d.ts" "docker/core" ".dockerignore" "locales" "docker-compose.yml")

  if [ "$include_documentation" = true ]; then
    files+=("docs" "docker-compose.docs.yml" "docker/docs")
  fi;

  if [ "$node_modules" = true ]; then
    files+=("node_modules")
  fi;

  files_string="$(join_by " " "${files[@]}")"
  tar -czvf bitbeat_$(date +'%F_%H-%M-%S').tar.gz $files_string
else
  files=("package*.json" "docs" "docker-compose.docs.yml" ".dockerignore" "docker/docs")

  if [ "$node_modules" = true ]; then
    files+=("node_modules")
  fi;

  files_string="$(join_by " " "${files[@]}")"
  tar -czvf bitbeat_docs_$(date +'%F_%H-%M-%S').tar.gz $files_string
fi