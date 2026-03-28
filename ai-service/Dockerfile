FROM python:3.10-slim

# Set the working directory
WORKDIR /code

# Copy requirements.txt and install dependencies
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . /code

# Change permissions for specific directories if needed (HF spaces run as user 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
	PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

COPY --chown=user . $HOME/app

# Expose port and run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]