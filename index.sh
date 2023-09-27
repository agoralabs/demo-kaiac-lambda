handler () {
    set -e
    EVENT_DATA=$1
    aws s3 ls $(echo $EVENT_DATA | jq ."bucket")
    echo "{\"success\": true}" >&2
}