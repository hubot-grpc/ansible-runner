FROM ubuntu:16.04

RUN useradd -m runner

RUN apt-get update && apt-get install -y ansible python-pip curl
RUN pip install -U boto

RUN curl -sL https://deb.nodesource.com/setup_6.x | bash -
RUN apt-get update && apt-get install -y nodejs

COPY ansible.cfg ansible.proto awsoperations.js ec2.ini ec2.py \
     package.json server.js tasks /home/runner/

COPY ansible.proto /api/main.proto
COPY sshkey /home/runner/.ssh

RUN chown -R runner /home/runner && \
    chmod -R 600 /home/runner/.ssh/* && \
    chmod +x /home/runner/ec2.py

WORKDIR /home/runner
USER runner
RUN npm install

CMD ["node", "server.js"]
