import os
import uuid

dataset_path = "data_set"

for root, dirs, files in os.walk(dataset_path):

    for file in files:

        old_path = os.path.join(root, file)

        # Skip directories
        if not os.path.isfile(old_path):
            continue

        ext = os.path.splitext(file)[1]

        # Create unique filename
        new_name = f"{uuid.uuid4().hex[:10]}{ext}"

        new_path = os.path.join(root, new_name)

        try:
            os.rename(old_path, new_path)
            print(f"Renamed: {file} -> {new_name}")

        except Exception as e:
            print(f"Error renaming {file}: {e}")

print("\nRenaming completed!")