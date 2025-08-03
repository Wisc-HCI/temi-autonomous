# These are *additional* changes based on the qual / family-school project's image

# disable internetcheck: /etc/cron.d/internet_check


pip install -r /home/pi/temi-autonomous/backend/requirements.txt --break-system-packages

sudo cp /home/pi/temi-autonomous/backend/setup_files/fastapi.service /etc/systemd/system/fastapi.service
sudo chmod 644 /etc/systemd/system/fastapi.service

sudo cp /home/pi/temi-autonomous/backend/setup_files/image-processor.service /etc/systemd/system/image-processor.service
sudo chmod 644 /etc/systemd/system/image-processor.service

sudo cp /home/pi/temi-autonomous/backend/setup_files/report.py /usr/bin/report.py
sudo chmod +x /usr/bin/report.py


sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable fastapi.service
sudo systemctl start fastapi.service
sudo systemctl enable image-processor.service
sudo systemctl start image-processor.service


sudo systemctl stop lti_base_startup.service
sudo systemctl disable lti_base_startup.service