#!/bin/bash

# Used to reset dirs, files, logs, etc. to get the PI ready for a new deployment
# Takes dir name as an input, and moves all existing logs/files/.. to ~/saved_logs/<timestamp>-<input>


USERNAME=$(id -u -n)
if [ $USERNAME = "root" ]; then
    echo "Did you use sudo? Please do not use sudo."
    exit
fi

echo "Name the directory for the saved logs:"
echo "(FINAL PATH will be ~/saved_logs/<timestamp>-<your input>)"
read DIRNAME



mkdir -p "/home/$USERNAME/saved_logs"
TIMESTAMP=$(date +"%Y-%m-%dT%H_%M_%S")
SAVE_DIR="/home/$USERNAME/saved_logs/$TIMESTAMP-$DIRNAME"
# echo $SAVE_DIR
sudo mv /home/$USERNAME/participant_data $SAVE_DIR
mkdir -p $SAVE_DIR/syslogs/
sudo cp /var/log/syslog* $SAVE_DIR/syslogs/


# Set things up again
sudo mkdir /home/$USERNAME/participant_data
sudo mkdir /home/$USERNAME/participant_data/media
sudo chown $USERNAME:$USERNAME -R /home/$USERNAME/participant_data

echo "Flushing Redis"
redis-cli FLUSHALL


echo "Logs and records saved to $SAVE_DIR"