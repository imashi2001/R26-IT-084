import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D
from tensorflow.keras.models import Model
import matplotlib.pyplot as plt
import os
import random
import numpy as np

# Dataset paths
train_dir = "data_set/train"
val_dir = "data_set/val"
test_dir = "data_set/test"

# Image settings
IMG_SIZE = (224, 224)
BATCH_SIZE = 32

# Windows can silently treat very-long paths as "not found" unless long paths are enabled.
# We avoid crashes by using the extended-length path prefix when needed.
MAX_ABS_PATH_CHARS = 250
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _list_class_dirs(split_dir: str):
    classes = [
        d for d in sorted(os.listdir(split_dir))
        if os.path.isdir(os.path.join(split_dir, d))
    ]
    if len(classes) != 2:
        raise ValueError(
            f"Expected exactly 2 class folders in '{split_dir}', found: {classes}"
        )
    return classes


def _collect_samples(split_dir: str, class_names):
    samples = []
    skipped = []

    def _to_extended_path(p: str) -> str:
        # Extended-length paths on Windows:
        # - Drive paths: \\?\C:\...
        # - UNC paths:   \\?\UNC\server\share\...
        if os.name != "nt":
            return p
        if p.startswith("\\\\?\\"):
            return p
        if p.startswith("\\\\"):
            # UNC path
            return "\\\\?\\UNC\\" + p.lstrip("\\")
        return "\\\\?\\" + p

    for label, cls in enumerate(class_names):
        cls_dir = os.path.join(split_dir, cls)
        for root, _, files in os.walk(cls_dir):
            for fn in files:
                ext = os.path.splitext(fn)[1].lower()
                if ext not in ALLOWED_EXTS:
                    continue

                rel_path = os.path.join(root, fn)
                abs_path = os.path.abspath(rel_path)
                abs_path_for_io = abs_path

                if len(abs_path) > MAX_ABS_PATH_CHARS:
                    abs_path_for_io = _to_extended_path(abs_path)

                try:
                    with open(abs_path_for_io, "rb") as f:
                        f.read(16)
                except Exception as e:
                    skipped.append((abs_path, f"open_failed={type(e).__name__}"))
                    continue

                # Store the I/O-safe path. Also keep the original path for reporting.
                samples.append((abs_path_for_io, float(label)))

    return samples, skipped


def _write_skipped_report(path: str, train_skipped, val_skipped, test_skipped):
    with open(path, "w", encoding="utf-8") as f:
        f.write("split\treason\tpath\n")
        for split_name, items in (
            ("train", train_skipped),
            ("val", val_skipped),
            ("test", test_skipped),
        ):
            for p, why in items:
                f.write(f"{split_name}\t{why}\t{p}\n")


class SafeImageSequence(tf.keras.utils.Sequence):
    def __init__(self, samples, datagen: ImageDataGenerator, batch_size: int, shuffle: bool):
        super().__init__()
        self.samples = list(samples)
        self.datagen = datagen
        self.batch_size = batch_size
        self.shuffle = shuffle
        self.indices = np.arange(len(self.samples))
        self.on_epoch_end()

    def __len__(self):
        return int(np.ceil(len(self.samples) / self.batch_size))

    def on_epoch_end(self):
        if self.shuffle:
            np.random.shuffle(self.indices)

    def __getitem__(self, idx):
        batch_idx = self.indices[idx * self.batch_size:(idx + 1) * self.batch_size]
        batch_samples = [self.samples[i] for i in batch_idx]

        x = np.zeros((len(batch_samples), IMG_SIZE[0], IMG_SIZE[1], 3), dtype=np.float32)
        y = np.zeros((len(batch_samples),), dtype=np.float32)

        for j, (path, label) in enumerate(batch_samples):
            # Keras utility uses PIL under the hood.
            img = tf.keras.utils.load_img(path, target_size=IMG_SIZE)
            arr = tf.keras.utils.img_to_array(img)
            arr = self.datagen.random_transform(arr)
            arr = self.datagen.standardize(arr)
            x[j] = arr
            y[j] = label

        return x, y

# Data augmentation
train_datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=15,
    zoom_range=0.1,
    horizontal_flip=True,
    brightness_range=[0.7, 1.3]
)

val_test_datagen = ImageDataGenerator(rescale=1./255)

# Build robust (pre-validated) datasets to avoid crashes from missing/unreadable/too-long paths.
train_classes = _list_class_dirs(train_dir)
val_classes = _list_class_dirs(val_dir)
test_classes = _list_class_dirs(test_dir)

if train_classes != val_classes or train_classes != test_classes:
    raise ValueError(
        f"Class folders mismatch:\n"
        f"train={train_classes}\nval={val_classes}\ntest={test_classes}"
    )

class_names = train_classes
print(f"Classes: {class_names} (label mapping: {class_names[0]}=0, {class_names[1]}=1)")

train_samples, train_skipped = _collect_samples(train_dir, class_names)
val_samples, val_skipped = _collect_samples(val_dir, class_names)
test_samples, test_skipped = _collect_samples(test_dir, class_names)

random.shuffle(train_samples)
random.shuffle(val_samples)
random.shuffle(test_samples)

print(f"Train samples: {len(train_samples)} (skipped {len(train_skipped)})")
print(f"Val samples:   {len(val_samples)} (skipped {len(val_skipped)})")
print(f"Test samples:  {len(test_samples)} (skipped {len(test_skipped)})")

_write_skipped_report("skipped_samples.tsv", train_skipped, val_skipped, test_skipped)
print("Wrote skipped report to: skipped_samples.tsv")

for p, why in (train_skipped[:5] + val_skipped[:5] + test_skipped[:5]):
    print(f"SKIP: {why} :: {p}")

train_data = SafeImageSequence(train_samples, train_datagen, BATCH_SIZE, shuffle=True)
val_data = SafeImageSequence(val_samples, val_test_datagen, BATCH_SIZE, shuffle=False)
test_data = SafeImageSequence(test_samples, val_test_datagen, BATCH_SIZE, shuffle=False)

# Load MobileNetV2 model
base_model = MobileNetV2(
    weights='imagenet',
    include_top=False,
    input_shape=(224, 224, 3)
)

# Freeze pretrained layers
for layer in base_model.layers:
    layer.trainable = False

# Add custom layers
x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(128, activation='relu')(x)
output = Dense(1, activation='sigmoid')(x)

# Final model
model = Model(inputs=base_model.input, outputs=output)

# Compile model
model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy']
)

# Train model
history = model.fit(
    train_data,
    validation_data=val_data,
    epochs=10
)

# Evaluate model
loss, accuracy = model.evaluate(test_data)

print(f"\nTest Accuracy: {accuracy * 100:.2f}%")

# Save model
model.save("waste_classification_model.h5")

print("\nModel saved successfully!")

# Plot accuracy graph (also saved so it can be used in slides / viva)
plt.figure(figsize=(7.2, 4.8))
plt.plot(history.history['accuracy'], label='Train Accuracy')
plt.plot(history.history['val_accuracy'], label='Validation Accuracy')

plt.xlabel('Epoch')
plt.ylabel('Accuracy')
plt.legend()
plt.title('Training Accuracy')
plt.tight_layout()
plt.savefig("training_accuracy.png", dpi=180)
plt.show()