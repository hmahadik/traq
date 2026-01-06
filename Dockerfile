FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    wget \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Go 1.21 (older version for compatibility)
RUN wget -q https://go.dev/dl/go1.21.13.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.21.13.linux-amd64.tar.gz \
    && rm go1.21.13.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:/root/go/bin:${PATH}"
ENV GOPATH="/root/go"

# Install older Wails v2.8.2 (last version to support Go 1.21)
RUN go install github.com/wailsapp/wails/v2/cmd/wails@v2.8.2

WORKDIR /app

# Copy source
COPY . .

# Install frontend dependencies
RUN cd frontend && npm install

# Build the app
RUN wails build

CMD ["./build/bin/traq"]
